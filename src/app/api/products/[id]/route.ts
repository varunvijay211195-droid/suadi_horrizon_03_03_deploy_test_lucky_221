import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Product from '@/lib/db/models/Product';
import { verifyAdminToken } from '@/lib/auth/adminAuth';
import { notifyLowStock } from '@/lib/notifications/adminNotifications';
import { deleteFromCloudinary } from '@/lib/cloudinary';

/**
 * Normalize a product from the API response.
 * Mongoose .populate() returns objects for brand/category/image,
 * but the UI expects plain strings. This flattens them.
 */
function normalizeProduct(p: any) {
    // Get the plain object from Mongoose document
    const doc = p._doc || p;

    let brand = doc.brand;
    if (brand && typeof brand === 'object') brand = brand.name || brand.slug || brand._id || '';

    let category = doc.category;
    if (category && typeof category === 'object') category = category.name || category.slug || category._id || '';

    let image = doc.image;
    if (image && typeof image === 'object') image = image.url || '';

    let images = doc.images;
    if (Array.isArray(images)) {
        images = images.map((img: any) =>
            img && typeof img === 'object' ? (img.url || '') : (img || '')
        ).filter(Boolean);
    }

    return { ...doc, brand, category, image, images };
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await connectDB();

        const product = await Product.findById(id).populate('brand category subcategory');

        if (!product) {
            return NextResponse.json(
                { error: 'Product not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(normalizeProduct(product));
    } catch (error: any) {
        console.error('Error fetching product:', error);
        return NextResponse.json(
            { error: 'Failed to fetch product', details: error.message },
            { status: 500 }
        );
    }
}

// PATCH /api/products/[id] - Update product (stock, price, name, etc.)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await verifyAdminToken(request);
    if (authResult.error) {
        return NextResponse.json(
            { error: authResult.error },
            { status: authResult.status }
        );
    }

    try {
        await connectDB();
        const { id } = await params;
        const body = await request.json();

        // Only allow certain fields to be updated
        const allowedFields = ['name', 'sku', 'price', 'stock', 'category', 'brand', 'image', 'isActive', 'description', 'inStock', 'subcategory'];
        const updateData: Record<string, any> = {};
        for (const key of allowedFields) {
            const val = body[key];
            if (val !== undefined) {
                updateData[key] = val;
            }
        }

        const oldProduct = await Product.findById(id);
        if (!oldProduct) {
            return NextResponse.json(
                { error: 'Product not found' },
                { status: 404 }
            );
        }

        // Handle Image Update Cleanup
        if (updateData.image && oldProduct.image?.public_id &&
            updateData.image.public_id !== oldProduct.image.public_id) {
            try {
                await deleteFromCloudinary(oldProduct.image.public_id);
            } catch (cleanupError) {
                console.warn('Failed to delete old image from Cloudinary:', cleanupError);
            }
        }

        // Ensure inStock reflects stock level if not explicitly provided
        if (updateData.stock !== undefined && updateData.inStock === undefined) {
            updateData.inStock = updateData.stock > 0;
        }

        const product = await Product.findByIdAndUpdate(id, updateData, { new: true }).populate('brand category subcategory');

        if (!product) {
            return NextResponse.json(
                { error: 'Product not found after update' },
                { status: 404 }
            );
        }

        // Check for low stock and notify admin if needed
        if (product.stock !== undefined && product.stock < 10) {
            try {
                await notifyLowStock(product.name, product.stock);
            } catch (notifyError) {
                console.warn('Failed to send low stock notification:', notifyError);
            }
        }

        return NextResponse.json(normalizeProduct(product));
    } catch (error: any) {
        console.error('Error updating product:', error);
        return NextResponse.json(
            { error: 'Failed to update product', details: error.message },
            { status: 500 }
        );
    }
}

// PUT /api/products/[id] - Full update product (alias for PATCH)
export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    return PATCH(request, context);
}

// DELETE /api/products/[id] - Delete product
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await verifyAdminToken(request);
    if (authResult.error) {
        return NextResponse.json(
            { error: authResult.error },
            { status: authResult.status }
        );
    }

    try {
        await connectDB();
        const { id } = await params;

        const product = await Product.findById(id);

        if (!product) {
            return NextResponse.json(
                { error: 'Product not found' },
                { status: 404 }
            );
        }

        // Cleanup Cloudinary Assets
        if (product.image?.public_id) {
            try {
                await deleteFromCloudinary(product.image.public_id);
            } catch (cleanupError) {
                console.warn('Failed to delete image from Cloudinary during product deletion:', cleanupError);
            }
        }

        // Cleanup Gallery Assets
        if (product.gallery && product.gallery.length > 0) {
            for (const img of product.gallery) {
                if (img.public_id) {
                    try {
                        await deleteFromCloudinary(img.public_id);
                    } catch (galError) {
                        console.warn('Failed to delete gallery image from Cloudinary:', galError);
                    }
                }
            }
        }

        await Product.findByIdAndDelete(id);

        return NextResponse.json({ message: 'Product deleted successfully', id });
    } catch (error: any) {
        console.error('Error deleting product:', error);
        return NextResponse.json(
            { error: 'Failed to delete product', details: error.message },
            { status: 500 }
        );
    }
}
