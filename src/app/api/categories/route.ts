import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Category from '@/lib/db/models/Category';

export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const isActive = searchParams.get('isActive');
        const parent = searchParams.get('parent');

        const query: any = {};
        if (isActive !== null) query.isActive = isActive === 'true';
        if (parent !== null) query.parent = parent === 'null' ? null : parent;

        const categories = await Category.find(query).sort({ displayOrder: 1, name: 1 });

        // Explicitly include _id in the response
        const formattedCategories = categories.map(c => ({
            _id: c._id,
            name: c.name,
            slug: c.slug,
            parent: c.parent,
            displayOrder: c.displayOrder,
            isActive: c.isActive
        }));

        return NextResponse.json({ categories: formattedCategories });
    } catch (error: any) {
        console.error('Error fetching categories from MongoDB:', error);
        return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
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

        const category = await Category.create(body);
        return NextResponse.json(category, { status: 201 });
    } catch (error: any) {
        console.error('Error creating category:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
