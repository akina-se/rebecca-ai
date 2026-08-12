import { Firestore } from '@google-cloud/firestore';
import * as admin from 'firebase-admin';

// Set emulator host env variables so SDKs target the local emulators
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

// Initialize Firebase Admin (targeting emulator)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'rebecca-ai-gal-local',
    credential: {
      getAccessToken: () => Promise.resolve({
        access_token: 'dummy-token',
        expires_in: 3600,
      }),
    },
  });
}

const firestore = new Firestore({
  projectId: 'rebecca-ai-gal-local',
});

async function seedAuth() {
  console.log('Seeding Firebase Auth Emulator...');
  try {
    // Delete existing user if exists to prevent duplicate errors
    try {
      await admin.auth().deleteUser('local-dev-admin');
    } catch {
      // Ignore if not found
    }

    const user = await admin.auth().createUser({
      uid: 'local-dev-admin',
      email: 'admin@example.com',
      password: 'password123',
      displayName: 'Rebecca Administrator',
      emailVerified: true,
    });
    console.log(`Successfully created dummy admin user in Auth Emulator: ${user.email}`);
  } catch (error) {
    console.warn('Auth Emulator seeding skipped (emulator not running):', (error as any).message || error);
  }
}

async function seedFirestore() {
  console.log('Seeding Firestore Emulator...');
  const collections = {
    users: firestore.collection('users'),
    timeline: firestore.collection('timeline_history'),
    conversationLogs: firestore.collection('conversation_logs'),
    images: firestore.collection('images'),
    system: firestore.collection('system'),
    systemStats: firestore.collection('system_stats'),
  };

  const now = new Date();

  // 1. Seed users
  const mockUsers = [];
  const userHandles = [
    'rebecca_oshi', 'tech_geek_tokyo', 'user_alpha_99', 'gundam_fan_88', 'cyber_pilot',
    'nerd_level_max', 'ai_enthusiast', 'manga_collector', 'tokyo_traveler', 'code_ninja',
    'neon_rider', 'digital_artist', 'pixel_pioneer', 'retro_gamer', 'synth_wave',
    'future_vision', 'data_hacker', 'cloud_surfer', 'robot_builder', 'quantum_leap',
    'otaku_prime', 'shibuya_stroller', 'ramen_lover_jp', 'game_developer', 'vr_world_explorer',
    'coffee_and_code', 'shinjuku_night', 'anime_music_fan', 'figure_collector', 'cosplay_maker'
  ];
  for (let i = 0; i < userHandles.length; i++) {
    const handle = userHandles[i];
    const daysAgo = Math.floor(Math.random() * 300);
    const firstSeenDate = new Date(Date.now() - (daysAgo + 30) * 24 * 3600000);
    const lastSeenDate = new Date(Date.now() - Math.floor(Math.random() * 5) * 24 * 3600000);
    
    mockUsers.push({
      id: handle,
      name: `@${handle}`,
      handle: `@${handle}`,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${handle}`,
      coreProfile: JSON.stringify({
        attributes: [i % 2 === 0 ? 'student' : 'engineer', i % 3 === 0 ? 'tokyo' : 'osaka'],
        preferences: [i % 2 === 0 ? 'anime' : 'gaming', i % 3 === 0 ? 'programming' : 'art'],
        concerns: i % 4 === 0 ? ['exams'] : [],
        important_memories: i % 5 === 0 ? [`promised to go to comiket ${i}`] : []
      }, null, 2),
      episodicBuffer: [
        { role: 'user', content: 'こんにちは！最近調子どう？', timestamp: new Date(Date.now() - 3600000 * (i + 1)).toISOString() },
        { role: 'model', content: 'こんにちは！とっても元気だよ！今日は何してるの？', timestamp: new Date(Date.now() - 3300000 * (i + 1)).toISOString() }
      ],
      status: i === 2 || i === 8 || i === 14 ? 'BLOCKED' : 'ACTIVE',
      daily_reply_count: i % 3 === 0 ? 3 : 1,
      affinityScore: Math.min(0.99, Math.max(0.1, Number((0.4 + (i * 0.02) + Math.sin(i)).toFixed(2)))),
      interactions: Math.floor(15 + i * 8 + Math.random() * 30),
      firstSeen: firstSeenDate.toISOString(),
      lastSeen: lastSeenDate.toISOString()
    });
  }

  for (const u of mockUsers) {
    const { id, ...data } = u;
    await collections.users.doc(id).set(data);
  }
  console.log(`Seeded ${mockUsers.length} users with affinity & interaction stats.`);

  // 2. Seed conversation logs (for chat drawer and infinite scroll)
  const sampleTopics = ['おすすめのアニメ', '昨日の出来事', '新しいゲームの感想', 'プログラミングの質問', '好きな食べ物'];
  let totalLogsCount = 0;
  for (let i = 0; i < mockUsers.length; i++) {
    const u = mockUsers[i];
    // Generate 15 conversation log entries for each user over the past 30 days
    for (let j = 0; j < 15; j++) {
      const logTime = new Date(Date.now() - (j * 2 * 86400000 + i * 3600000));
      const topic = sampleTopics[j % sampleTopics.length];
      await collections.conversationLogs.add({
        userId: u.id,
        userText: `ユーザーの質問 #${j + 1}: ${topic}について教えて！`,
        aiText: `レベッカの回答 #${j + 1}: ${topic}は本当に素晴らしいよね！私も大好きだよ。`,
        timestamp: logTime.toISOString(),
        expireAt: new Date(logTime.getTime() + 30 * 24 * 3600000).toISOString()
      });
      totalLogsCount++;
    }
  }
  console.log(`Seeded ${totalLogsCount} conversation logs for infinite scrolling.`);

  // 3. Seed timeline posts (spanning 365 days across 2025 and 2026)
  const posts = [];
  const topics = [
    '水星の魔女、最新話見た！？展開が熱すぎる…',
    'おはよう！今日も1日頑張ろうね',
    '夏コミ行く人いるー？',
    'AIプログラミングが楽しくて夜更かししちゃった',
    'TypeScriptの型パズル、解けると気持ちいい',
    '今日はカフェで作業。BGMが心地よいです',
    '最近話題の画像生成AIを使ってみたけど凄すぎる',
    '温泉旅行に行きたいなぁ…のんびりしたい',
    '美味しいラーメン屋さんを見つけた！替え玉しちゃった',
    '新しいキーボードを購入！打鍵感が最高です',
    '新アニメの第1話、作画が神がかってた！',
    '週末の秋葉原散策。掘り出し物を発見！',
    '深夜のデバッグ作業。コーヒーがお友達です',
    '新しいAIモデルの精度が上がっててビックリ！',
    '明日は早起きして散歩しようかな'
  ];
  
  // Create 120 posts spanning across 365 days
  for (let i = 1; i <= 120; i++) {
    const topic = topics[(i - 1) % topics.length];
    // Spread timestamps across 365 days (approx 3 days per post)
    const daysOffset = Math.floor((i / 120) * 365);
    const postDate = new Date(Date.now() - daysOffset * 24 * 3600000 - (i % 12) * 3600000);
    const authorIndex = (i - 1) % mockUsers.length;
    const author = mockUsers[authorIndex];

    posts.push({
      id: `p${i}`,
      text: `${topic} (No. ${i})`,
      timestamp: postDate.toISOString(),
      expireAt: new Date(postDate.getTime() + 30 * 24 * 3600000).toISOString(),
      status: 'SUCCESS',
      impressions: Math.floor(1200 + (120 - i) * 80 + Math.sin(i) * 500),
      likes: Math.floor(150 + (120 - i) * 10 + Math.cos(i) * 80),
      retweets: Math.floor(20 + (120 - i) * 2),
      replies: Math.floor(8 + (120 - i) * 1),
      mediaUrls: i % 4 === 0 ? [`https://picsum.photos/seed/post${i}/600/400`] : [],
      authorId: author.id,
      authorName: author.name,
      authorHandle: author.handle,
      authorAvatarUrl: author.avatarUrl
    });
  }

  for (const p of posts) {
    const { id, ...data } = p;
    await collections.timeline.doc(id).set(data);
  }
  console.log(`Seeded ${posts.length} timeline posts across 365 days.`);

  // 4. Seed images (assets library)
  const images = [];
  const assetNames = [
    'cyberpunk_street', 'chibi_sketch', 'sunset_cityscape', 'beach_background', 'anime_girl_portrait',
    'retro_console', 'neon_tokyo', 'workspace_setup', 'mountain_lake', 'future_robot',
    'fantasy_castle', 'pixel_art_room', 'starry_sky', 'cafe_interior', 'steampunk_gear'
  ];
  for (let i = 1; i <= 15; i++) {
    const name = assetNames[i - 1];
    images.push({
      id: `a${i}`,
      url: `https://picsum.photos/seed/asset${i}/600/400`,
      caption: `Caption description for ${name}`,
      embedding: new Array(1536).fill(0.01 * i),
      lastUsedAt: i % 3 === 0 ? new Date(Date.now() - 3600000 * i).toISOString() : null,
      useCount: i % 3 === 0 ? i * 2 : 0,
      status: i === 3 || i === 9 ? 'FAILED' : 'SUCCESS'
    });
  }

  for (const img of images) {
    const { id, ...data } = img;
    await collections.images.doc(id).set(data);
    console.log(`Seeded asset: ${img.id}`);
  }

  // 5. Seed system configurations
  await collections.system.doc('persona').set({
    extended_prompt: 'You are Rebecca, an AI virtual friend. Be helpful, engaging, and friendly.',
    updatedAt: now.toISOString(),
    timeline_summary: 'Rebecca AI is highly active and talking about anime and coding.',
    timelineSummaryUpdatedAt: now.toISOString()
  });
  console.log('Seeded system/persona document.');

  // 6. Seed system stats (KPI trends & Global metrics)
  const days = 10;
  for (let i = 0; i < days; i++) {
    const day = new Date(Date.now() - i * 24 * 3600000);
    const dayStr = day.toISOString().split('T')[0];
    await collections.systemStats.doc(`dau_${dayStr}`).set({
      count: Math.floor(80 + Math.random() * 50)
    });
  }
  await collections.systemStats.doc('global').set({
    total_followers: 12040,
    followers_trend: 12.4,
    followers_history: [11500, 11620, 11710, 11800, 11920, 11990, 12040],
    avg_engagement_rate: 4.8,
    engagement_trend: 8.2,
    engagement_history: [4.2, 4.5, 4.3, 4.6, 4.7, 4.5, 4.8],
    dau: 95,
    dau_trend: -3.5,
    dau_history: [102, 98, 95, 99, 101, 92, 95],
    api_calls_today: 1420,
    api_trend_status: 'Steady',
    api_calls_history: [1200, 1350, 1300, 1400, 1380, 1450, 1420]
  });
  console.log('Seeded system stats / DAU & Global stats.');

  console.log('Firestore seeding completed successfully.');
}

async function run() {
  await seedAuth();
  await seedFirestore();
  console.log('All local emulator seed operations completed!');
}

run().catch(console.error);
