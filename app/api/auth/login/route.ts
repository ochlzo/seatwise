// import { NextRequest, NextResponse } from 'next/server';
// import { adminAuth } from '@/lib/firebaseAdmin';
// import { prisma } from '@/lib/prisma'; // your Prisma singleton

// export async function POST(req: NextRequest) {
//     try {
//         const { idToken } = await req.json();
//         if (!idToken) {
//             return NextResponse.json({ error: 'Missing token' }, { status: 400 });
//         }

//         // 1. Verify with Firebase Admin
//         const decoded = await adminAuth.verifyIdToken(idToken);

//         const uid = decoded.uid;
//         const email = decoded.email ?? null;
//         const name = decoded.name ?? '';
//         const [firstName, ...rest] = name.split(' ');
//         const lastName = rest.join(' ') || null;

//         // 2. Upsert user in your MySQL DB
//         const user = await prisma.user.upsert({
//             where: { firebase_uid: uid },
//             update: {
//                 email,
//                 first_name: firstName || null,
//                 last_name: lastName,
//             },
//             create: {
//                 firebase_uid: uid,
//                 email,
//                 first_name: firstName || null,
//                 last_name: lastName,
//             },
//         });

//         // TODO: set your own session/cookies here if you want

//         return NextResponse.json({ user });
//     } catch (err) {
//         console.error(err);
//         return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
//     }
// }
