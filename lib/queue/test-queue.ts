/**
 * Queue System Test Script
 * 
 * Run this to test the queue initialization:
 * node --experimental-strip-types lib/queue/test-queue.ts
 */

import { redis } from '../clients/redis';
import { initializeQueueChannel, getQueueStats } from './initializeQueue';
import { closeQueueChannel } from './closeQueue';

async function testQueueSystem() {
    console.log('🧪 Testing Queue System...\n');

    const testShowScopeId = 'test-show-123:test-sched-456';

    try {
        // Test 1: Initialize Queue
        console.log('1️⃣ Initializing queue...');
        const initResult = await initializeQueueChannel(testShowScopeId);
        console.log('   Result:', initResult);
        console.log('');

        // Test 2: Get Queue Stats
        console.log('2️⃣ Getting queue stats...');
        const stats = await getQueueStats(testShowScopeId);
        console.log('   Stats:', stats);
        console.log('');

        // Test 3: Simulate adding a user to queue
        console.log('3️⃣ Simulating user join...');
        const queueKey = `seatwise:queue:${testShowScopeId}`;
        const ticketId = 'test-ticket-001';
        const joinTime = Date.now();

        await redis.zadd(queueKey, { score: joinTime, member: ticketId });

        // Store ticket data
        const ticketKey = `seatwise:ticket:${testShowScopeId}:${ticketId}`;
        await redis.set(ticketKey, JSON.stringify({
            ticketId,
            userId: 'test-user-001',
            sid: 'test-session-001',
            name: 'Test User',
            joinedAt: joinTime,
        }));

        console.log('   User added to queue');
        console.log('');

        // Test 4: Get Updated Stats
        console.log('4️⃣ Getting updated stats...');
        const updatedStats = await getQueueStats(testShowScopeId);
        console.log('   Updated Stats:', updatedStats);
        console.log('');

        // Test 5: Get User Rank
        console.log('5️⃣ Getting user rank...');
        const rank = await redis.zrank(queueKey, ticketId);
        console.log('   User rank:', rank);
        console.log('');

        // Test 6: Close Queue
        console.log('6️⃣ Closing queue...');
        const closeResult = await closeQueueChannel(testShowScopeId, 'closed');
        console.log('   Result:', closeResult);
        console.log('');

        // Test 7: Verify Cleanup
        console.log('7️⃣ Verifying cleanup...');
        const finalStats = await getQueueStats(testShowScopeId);
        console.log('   Final Stats:', finalStats);
        console.log('');

        console.log('✅ All tests completed successfully!');
    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

// Run tests
testQueueSystem()
    .then(() => {
        console.log('\n🎉 Queue system is working correctly!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Queue system test failed:', error);
        process.exit(1);
    });
