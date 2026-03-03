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

export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const brand = searchParams.get('brand');
        const priceMin = searchParams.get('priceMin');
        const priceMax = searchParams.get('priceMax');
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '100');

        // Build query
        const query: any = {};

        if (category && category !== 'all') {
            query.category = category;
        }
        if (brand && brand !== 'all') {
            query.brand = brand;
        }
        if (priceMin || priceMax) {
            query.price = {};
            if (priceMin) query.price.$gte = parseFloat(priceMin);
            if (priceMax) query.price.$lte = parseFloat(priceMax);
        }
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { sku: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (page - 1) * limit;
        const products = await Product.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Product.countDocuments(query);

        return NextResponse.json(
            {
                products: products.map(normalizeProduct),
                total,
                page,
                limit,
                _source: 'mongodb'
            },
            {
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                }
            }
        );
    } catch (error: any) {
        console.error('Error fetching products from MongoDB:', error);
        return NextResponse.json(
            { error: 'Failed to fetch products', details: error.message },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        await connectDB();

        const body = await request.json();

        // Ensure body is an object or array of objects
        if (!body || (typeof body !== 'object')) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const productsData = Array.isArray(body) ? body : [body];

        // Basic validation before insert
        for (const p of productsData) {
            if (!p.name || !p.sku || !p.price || !p.brand || !p.category) {
                return NextResponse.json({
                    error: 'Missing required fields',
                    required: ['name', 'sku', 'price', 'brand', 'category'],
                    received: p
                }, { status: 400 });
            }

            // Ensure ID matches SKU or is unique
            if (!p._id) {
                p._id = p.sku;
            }
        }

        // Insert products
        const inserted = await Product.insertMany(productsData, { ordered: false });

        return NextResponse.json({
            success: true,
            message: `Successfully created ${inserted.length} product(s)`,
            count: inserted.length,
            products: inserted
        });
    } catch (error: any) {
        console.error('Error creating products:', error);

        // Handle duplicate key error specially
        if (error.code === 11000) {
            return NextResponse.json(
                { error: 'A product with this SKU already exists', details: error.writeErrors?.[0]?.errmsg || error.message },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to create products', details: error.message },
            { status: 500 }
        );
    }
}
