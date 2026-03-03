import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
    try {
        await connectDB();
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { message: 'Email and password are required' },
                { status: 400 }
            );
        }

        const user = await User.findOne({ email });

        if (!user) {
            return NextResponse.json(
                { message: 'Invalid credentials' },
                { status: 401 }
            );
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return NextResponse.json(
                { message: 'Invalid credentials' },
                { status: 401 }
            );
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        user.refreshToken = refreshToken;
        user.lastLoginAt = new Date();
        
        if (user.totalOrders && user.totalOrders > 0) {
            if (user.totalSpent && user.totalSpent > 50000) {
                user.segment = 'vip';
            } else if (user.profile?.company) {
                user.segment = 'b2b';
            } else {
                user.segment = 'regular';
            }
        }
        
        await user.save();

        return NextResponse.json({
            token: accessToken,
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                email: user.email,
                name: user.profile?.name || 'User',
                role: user.role,
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}

            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}

            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}

        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}
                email: user.email,
                name: user.profile?.name || 'User',
                role: user.role,
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}

                name: user.profile?.name || 'User',
                role: user.role,
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}

                name: user.profile?.name || 'User',
                role: user.role,
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}

                email: user.email,
                name: user.profile?.name || 'User',
                role: user.role,
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}


