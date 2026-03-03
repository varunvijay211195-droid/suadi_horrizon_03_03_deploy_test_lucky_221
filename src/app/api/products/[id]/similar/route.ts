import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Product from '@/lib/db/models/Product';

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

        // Find the current product to get its category
        const currentProduct = await Product.findById(id);

        if (!currentProduct) {
            return NextResponse.json(
                { error: 'Product not found' },
                { status: 404 }
            );
        }

        // Find similar products (same category, excluding current product)
        const similarProducts = await Product.find({
            _id: { $ne: id },
            category: currentProduct.category,
            isActive: { $ne: false }
        }).limit(4).populate('brand category');

        return NextResponse.json(similarProducts.map(normalizeProduct));
    } catch (error: any) {
        console.error('Error fetching similar products from MongoDB:', error);
        return NextResponse.json(
            { error: 'Failed to fetch similar products', details: error.message },
            { status: 500 }
        );
    }
}
