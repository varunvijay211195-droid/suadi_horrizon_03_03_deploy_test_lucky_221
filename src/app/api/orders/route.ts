import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Order from '@/lib/db/models/Order';
import User from '@/lib/db/models/User';
import Product from '@/lib/db/models/Product';
import { notifyNewOrder } from '@/lib/notifications/adminNotifications';
import { sendOrderConfirmationEmail } from '@/lib/notifications/userNotifications';

export async function POST(request: NextRequest) {
    try {
        await connectDB();

        const body = await request.json();
        const { userId, items, totalAmount, shippingAddress } = body;

        // Validation
        if (!userId || !items || !totalAmount || !shippingAddress) {
            return NextResponse.json(
                { message: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Create order
        const order = await Order.create({
            user: userId,
            items,
            totalAmount,
            shippingAddress,
            status: 'pending'
        });

        // ─── NOTIFICATIONS ───────────────────────────────────────────────

        // Fetch expanded data for the email
        const populatedOrder = await Order.findById(order._id).populate('items.product');
        const user = await User.findById(userId);

        if (populatedOrder && (shippingAddress?.email || user?.email)) {
            const customerEmail = shippingAddress?.email || user?.email;
            const customerName = shippingAddress?.name || user?.profile?.name || 'Customer';

            // Send Confirmation Email to User (Non-blocking)
            sendOrderConfirmationEmail(customerEmail, customerName, populatedOrder)
                .catch(err => console.error('Order confirmation email failed:', err));
        }

        // Create admin notification for new order (Non-blocking)
        notifyNewOrder(
            order._id.toString(),
            totalAmount,
            shippingAddress?.email || user?.email
        ).catch(err => console.error('Admin order notification failed:', err));

        // ─── USER PROFILE UPDATE FOR MARKETING ───────────────────────────────
        
        // Update user's purchase history and segment
        if (user) {
            // Get product details for purchase history
            const productIds = items.map((item: any) => item.product);
            const products = await Product.find({ _id: { $in: productIds } });
            const productMap = new Map(products.map(p => [p._id, p]));
            
            // Build purchase history items
            const purchaseItems = items.map((item: any) => {
                const product = productMap.get(item.product);
                return {
                    orderId: order._id,
                    productId: item.product,
                    productName: item.name || product?.name || 'Product',
                    category: product?.category || '',
                    brand: product?.brand || '',
                    amount: item.price * item.quantity,
                    purchasedAt: new Date()
                };
            });
            
            // Update user marketing fields
            user.totalSpent = (user.totalSpent || 0) + totalAmount;
            user.totalOrders = (user.totalOrders || 0) + 1;
            
            // Add to purchase history
            if (!user.purchaseHistory) user.purchaseHistory = [];
            user.purchaseHistory.push(...purchaseItems);
            
            // Keep only last 50 purchases
            if (user.purchaseHistory.length > 50) {
                user.purchaseHistory = user.purchaseHistory.slice(-50);
            }
            
            // Update preferred categories based on purchases
            const categories = new Set(user.preferredCategories || []);
            const brands = new Set(user.preferredBrands || []);
            
            products.forEach((p: any) => {
                if (p.category) categories.add(p.category);
                if (p.brand) brands.add(p.brand);
            });
            
            user.preferredCategories = Array.from(categories);
            user.preferredBrands = Array.from(brands);
            
            // Update segment based on spending
            if (user.totalSpent > 50000) {
                user.segment = 'vip';
            } else if (user.profile?.company) {
                user.segment = 'b2b';
            } else if (user.totalOrders && user.totalOrders > 0) {
                user.segment = 'regular';
            }
            
            await user.save();
        }

        return NextResponse.json(order, { status: 201 });
    } catch (error: unknown) {
        console.error('Error creating order:', error);
        return NextResponse.json(
            { message: 'Failed to create order' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        let userId = searchParams.get('userId');
        const admin = searchParams.get('admin');

        // If admin parameter is set, return all orders (for admin panel)
        if (admin === 'true' || admin === '1') {
            const orders = await Order.find()
                .populate('items.product')
                .populate('user', 'email name')
                .sort({ createdAt: -1 });

            return NextResponse.json({ orders });
        }

        // If no userId provided, try to extract from auth token
        if (!userId) {
            const { verifyAuth } = await import('@/lib/auth/middleware');
            const user = await verifyAuth(request);
            if (user) {
                userId = user.sub;
            }
        }

        // Regular user order fetch requires userId
        if (!userId) {
            return NextResponse.json(
                { message: 'Authentication required to view orders' },
                { status: 401 }
            );
        }

        const orders = await Order.find({ user: userId })
            .populate('items.product')
            .sort({ createdAt: -1 });

        return NextResponse.json(orders);
    } catch (error: unknown) {
        console.error('Error fetching orders:', error);
        return NextResponse.json(
            { message: 'Failed to fetch orders' },
            { status: 500 }
        );
    }
}
        }

        return NextResponse.json(order, { status: 201 });
    } catch (error: unknown) {
        console.error('Error creating order:', error);
        return NextResponse.json(
            { message: 'Failed to create order' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        let userId = searchParams.get('userId');
        const admin = searchParams.get('admin');

        // If admin parameter is set, return all orders (for admin panel)
        if (admin === 'true' || admin === '1') {
            const orders = await Order.find()
                .populate('items.product')
                .populate('user', 'email name')
                .sort({ createdAt: -1 });

            return NextResponse.json({ orders });
        }

        // If no userId provided, try to extract from auth token
        if (!userId) {
            const { verifyAuth } = await import('@/lib/auth/middleware');
            const user = await verifyAuth(request);
            if (user) {
                userId = user.sub;
            }
        }

        // Regular user order fetch requires userId
        if (!userId) {
            return NextResponse.json(
                { message: 'Authentication required to view orders' },
                { status: 401 }
            );
        }

        const orders = await Order.find({ user: userId })
            .populate('items.product')
            .sort({ createdAt: -1 });

        return NextResponse.json(orders);
    } catch (error: unknown) {
        console.error('Error fetching orders:', error);
        return NextResponse.json(
            { message: 'Failed to fetch orders' },
            { status: 500 }
        );
    }
}


        return NextResponse.json(order, { status: 201 });
    } catch (error: unknown) {
        console.error('Error creating order:', error);
        return NextResponse.json(
            { message: 'Failed to create order' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        let userId = searchParams.get('userId');
        const admin = searchParams.get('admin');

        // If admin parameter is set, return all orders (for admin panel)
        if (admin === 'true' || admin === '1') {
            const orders = await Order.find()
                .populate('items.product')
                .populate('user', 'email name')
                .sort({ createdAt: -1 });

            return NextResponse.json({ orders });
        }

        // If no userId provided, try to extract from auth token
        if (!userId) {
            const { verifyAuth } = await import('@/lib/auth/middleware');
            const user = await verifyAuth(request);
            if (user) {
                userId = user.sub;
            }
        }

        // Regular user order fetch requires userId
        if (!userId) {
            return NextResponse.json(
                { message: 'Authentication required to view orders' },
                { status: 401 }
            );
        }

        const orders = await Order.find({ user: userId })
            .populate('items.product')
            .sort({ createdAt: -1 });

        return NextResponse.json(orders);
    } catch (error: unknown) {
        console.error('Error fetching orders:', error);
        return NextResponse.json(
            { message: 'Failed to fetch orders' },
            { status: 500 }
        );
    }
}

        }

        return NextResponse.json(order, { status: 201 });
    } catch (error: unknown) {
        console.error('Error creating order:', error);
        return NextResponse.json(
            { message: 'Failed to create order' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        let userId = searchParams.get('userId');
        const admin = searchParams.get('admin');

        // If admin parameter is set, return all orders (for admin panel)
        if (admin === 'true' || admin === '1') {
            const orders = await Order.find()
                .populate('items.product')
                .populate('user', 'email name')
                .sort({ createdAt: -1 });

            return NextResponse.json({ orders });
        }

        // If no userId provided, try to extract from auth token
        if (!userId) {
            const { verifyAuth } = await import('@/lib/auth/middleware');
            const user = await verifyAuth(request);
            if (user) {
                userId = user.sub;
            }
        }

        // Regular user order fetch requires userId
        if (!userId) {
            return NextResponse.json(
                { message: 'Authentication required to view orders' },
                { status: 401 }
            );
        }

        const orders = await Order.find({ user: userId })
            .populate('items.product')
            .sort({ createdAt: -1 });

        return NextResponse.json(orders);
    } catch (error: unknown) {
        console.error('Error fetching orders:', error);
        return NextResponse.json(
            { message: 'Failed to fetch orders' },
            { status: 500 }
        );
    }
}


