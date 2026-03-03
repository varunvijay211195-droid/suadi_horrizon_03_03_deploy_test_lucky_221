import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Brand from '@/lib/db/models/Brand';

export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const isActive = searchParams.get('isActive');
        const isFeatured = searchParams.get('isFeatured');

        const query: any = {};
        if (isActive !== null) query.isActive = isActive === 'true';
        if (isFeatured !== null) query.isFeatured = isFeatured === 'true';

        const brands = await Brand.find(query).sort({ name: 1 });

        // Explicitly include _id in the response
        const formattedBrands = brands.map(b => ({
            _id: b._id,
            name: b.name,
            slug: b.slug,
            logo: b.logo,
            description: b.description,
            isFeatured: b.isFeatured,
            isActive: b.isActive
        }));

        return NextResponse.json({ brands: formattedBrands });
    } catch (error: any) {
        console.error('Error fetching brands:', error);
        return NextResponse.json({ error: 'Failed to fetch brands', details: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        await connectDB();
        const body = await request.json();

        // Ensure _id is provided or generated from slug
        if (!body._id && body.slug) {
            body._id = body.slug;
        }

        const brand = await Brand.create(body);
        return NextResponse.json(brand, { status: 201 });
    } catch (error: any) {
        console.error('Error creating brand:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
