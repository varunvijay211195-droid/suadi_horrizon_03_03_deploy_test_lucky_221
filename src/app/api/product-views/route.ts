import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import ProductView from '@/lib/db/models/ProductView';
import { verifyAuth } from '@/lib/auth/middleware';

// POST - Track a product view
export async function POST(req: NextRequest) {
    try {
        await connectDB();

        // Get optional authentication
        const auth = await verifyAuth(req);
        
        const body = await req.json();
        const {
            productId,
            productName,
            category,
            brand,
            referrer,
            duration,
            deviceType,
            sessionId
        } = body;

        if (!productId) {
            return NextResponse.json(
                { error: 'productId is required' },
                { status: 400 }
            );
        }

        // Get session ID from body or headers
        const sessionIdToUse = sessionId || req.headers.get('x-session-id') || `session_${Date.now()}`;

        const productView = await ProductView.create({
            userId: auth?.sub ? auth.sub : null,
            sessionId: sessionIdToUse,
            productId,
            productName,
            category,
            brand,
            referrer,
            duration,
            deviceType: deviceType || 'desktop',
            viewedAt: new Date()
        });

        return NextResponse.json(
            { success: true, viewId: productView._id },
            { status: 201 }
        );
    } catch (error: any) {
        console.error('Error tracking product view:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

// GET - Get product view analytics (admin only)
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        
        // Only admins can view analytics
        if (!auth || auth.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        const { searchParams } = new URL(req.url);
        const period = searchParams.get('period') || '7'; // days
        const productId = searchParams.get('productId');
        const category = searchParams.get('category');
        const brand = searchParams.get('brand');

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(period));

        const filter: any = {
            viewedAt: { $gte: startDate }
        };

        if (productId) filter.productId = productId;
        if (category) filter.category = category;
        if (brand) filter.brand = brand;

        // Get view counts
        const totalViews = await ProductView.countDocuments(filter);
        
        // Get unique viewers
        const uniqueViewers = await ProductView.distinct('sessionId', filter);
        
        // Get views by product
        const viewsByProduct = await ProductView.aggregate([
            { $match: filter },
            { $group: { _id: '$productId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Get views by category
        const viewsByCategory = await ProductView.aggregate([
            { $match: { ...filter, category: { $ne: null } } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Get views by brand
        const viewsByBrand = await ProductView.aggregate([
            { $match: { ...filter, brand: { $ne: null } } },
            { $group: { _id: '$brand', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Get average view duration
        const avgDuration = await ProductView.aggregate([
            { $match: { ...filter, duration: { $exists: true, $ne: null } } },
            { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
        ]);

        return NextResponse.json({
            totalViews,
            uniqueViewers: uniqueViewers.length,
            viewsByProduct,
            viewsByCategory,
            viewsByBrand,
            avgDuration: avgDuration[0]?.avgDuration || 0,
            period: parseInt(period)
        });
    } catch (error: any) {
        console.error('Error fetching product view analytics:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
import { connectDB } from '@/lib/db/mongodb';
import ProductView from '@/lib/db/models/ProductView';
import { verifyAuth } from '@/lib/auth/middleware';

// POST - Track a product view
export async function POST(req: NextRequest) {
    try {
        await connectDB();

        // Get optional authentication
        const auth = await verifyAuth(req);
        
        const body = await req.json();
        const {
            productId,
            productName,
            category,
            brand,
            referrer,
            duration,
            deviceType,
            sessionId
        } = body;

        if (!productId) {
            return NextResponse.json(
                { error: 'productId is required' },
                { status: 400 }
            );
        }

        // Get session ID from body or headers
        const sessionIdToUse = sessionId || req.headers.get('x-session-id') || `session_${Date.now()}`;

        const productView = await ProductView.create({
            userId: auth?.sub ? auth.sub : null,
            sessionId: sessionIdToUse,
            productId,
            productName,
            category,
            brand,
            referrer,
            duration,
            deviceType: deviceType || 'desktop',
            viewedAt: new Date()
        });

        return NextResponse.json(
            { success: true, viewId: productView._id },
            { status: 201 }
        );
    } catch (error: any) {
        console.error('Error tracking product view:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

// GET - Get product view analytics (admin only)
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        
        // Only admins can view analytics
        if (!auth || auth.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        const { searchParams } = new URL(req.url);
        const period = searchParams.get('period') || '7'; // days
        const productId = searchParams.get('productId');
        const category = searchParams.get('category');
        const brand = searchParams.get('brand');

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(period));

        const filter: any = {
            viewedAt: { $gte: startDate }
        };

        if (productId) filter.productId = productId;
        if (category) filter.category = category;
        if (brand) filter.brand = brand;

        // Get view counts
        const totalViews = await ProductView.countDocuments(filter);
        
        // Get unique viewers
        const uniqueViewers = await ProductView.distinct('sessionId', filter);
        
        // Get views by product
        const viewsByProduct = await ProductView.aggregate([
            { $match: filter },
            { $group: { _id: '$productId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Get views by category
        const viewsByCategory = await ProductView.aggregate([
            { $match: { ...filter, category: { $ne: null } } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Get views by brand
        const viewsByBrand = await ProductView.aggregate([
            { $match: { ...filter, brand: { $ne: null } } },
            { $group: { _id: '$brand', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Get average view duration
        const avgDuration = await ProductView.aggregate([
            { $match: { ...filter, duration: { $exists: true, $ne: null } } },
            { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
        ]);

        return NextResponse.json({
            totalViews,
            uniqueViewers: uniqueViewers.length,
            viewsByProduct,
            viewsByCategory,
            viewsByBrand,
            avgDuration: avgDuration[0]?.avgDuration || 0,
            period: parseInt(period)
        });
    } catch (error: any) {
        console.error('Error fetching product view analytics:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

