import { Firestore } from '@google-cloud/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Safety check: Prevent execution against production or staging environments
const targetProjectId = process.env.GCP_PROJECT_ID || 'rebecca-ai-gal-local';

if (
  process.env.NODE_ENV === 'production' ||
  targetProjectId === 'rebecca-ai-gal' ||
  !targetProjectId.endsWith('-local')
) {
  console.error(`FATAL: seed-db.ts cannot run against production or non-local project '${targetProjectId}'.`);
  process.exit(1);
}

// Set emulator host env variables so SDKs target the local emulators
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

// Initialize Firebase Admin (strictly targeting emulator)
if (!getApps().length) {
  initializeApp({
    projectId: targetProjectId,
    credential: {
      getAccessToken: () => Promise.resolve({
        access_token: 'dummy-token',
        expires_in: 3600,
      }),
    },
  });
}

const firestore = new Firestore({
  projectId: targetProjectId,
});

/**
 * Seeds the local Firebase Authentication emulator with a dummy admin user.
 * Deletes the user first if they already exist to avoid duplication errors.
 * 
 * @returns A promise that resolves when the auth seeding is complete.
 */
async function seedAuth() {
  console.log('Seeding Firebase Auth Emulator...');
  try {
    // Delete existing user if exists to prevent duplicate errors
    try {
      await getAuth().deleteUser('local-dev-admin');
    } catch {
      // Ignore if not found
    }

    const user = await getAuth().createUser({
      uid: 'local-dev-admin',
      email: 'admin@example.com',
      password: 'password123',
      displayName: 'Rebecca Administrator',
      emailVerified: true,
    });
    await getAuth().setCustomUserClaims(user.uid, { role: 'SUPER_ADMIN', admin: true });
    await firestore.collection('admin_users').doc(user.uid).set({
      email: 'admin@example.com',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    });
    console.log(`Successfully created dummy admin user with SUPER_ADMIN privileges: ${user.email}`);
  } catch (error) {
    console.warn('Auth Emulator seeding skipped (emulator not running):', (error as Error).message || error);
  }
}

/**
 * Seeds the local Firestore emulator with sample data for users, timeline posts, conversation logs, assets, and system stats.
 * This populates the dashboard for local development.
 * 
 * @returns A promise that resolves when the Firestore seeding is complete.
 */
async function seedFirestore() {
  console.log('Seeding Firestore Emulator...');
  const collections = {
    users: firestore.collection('users'),
    timeline: firestore.collection('timeline_history'),
    conversationLogs: firestore.collection('conversation_logs'),
    ragMemories: firestore.collection('rag_memories'),
    images: firestore.collection('images'),
    system: firestore.collection('system'),
    systemStats: firestore.collection('system_stats'),
    processedFollowers: firestore.collection('processed_followers'),
    rewardImages: firestore.collection('reward_images'),
    supportTransactions: firestore.collection('support_transactions'),
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
  const mockNames = [
    "Rebecca Oshi", "Tech Geek Tokyo", "Alpha 99", "Gundam Fan 88", "Cyber Pilot",
    "Nerd Level Max", "AI Enthusiast", "Manga Collector", "Tokyo Traveler", "Code Ninja",
    "Neon Rider", "Digital Artist", "Pixel Pioneer", "Retro Gamer", "Synth Wave",
    "Future Vision", "Data Hacker", "Cloud Surfer", "Robot Builder", "Quantum Leap",
    "Otaku Prime", "Shibuya Stroller", "Ramen Lover JP", "Game Developer", "VR World Explorer",
    "Coffee And Code", "Shinjuku Night", "Anime Music Fan", "Figure Collector", "Cosplay Maker"
  ];
  for (let i = 0; i < userHandles.length; i++) {
    const handle = userHandles[i];
    const userName = mockNames[i] || `@${handle}`;
    const daysAgo = Math.floor(Math.random() * 300);
    const firstSeenDate = new Date(Date.now() - (daysAgo + 30) * 24 * 3600000);
    const lastSeenDate = new Date(Date.now() - Math.floor(Math.random() * 5) * 24 * 3600000);
    
    mockUsers.push({
      id: handle,
      name: userName,
      username: handle,
      handle: `@${handle}`,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${handle}`,
      coreProfile: {
        name: userName,
        attributes: [i % 2 === 0 ? 'student' : 'engineer', i % 3 === 0 ? 'tokyo' : 'osaka'],
        preferences: [i % 2 === 0 ? 'anime' : 'gaming', i % 3 === 0 ? 'programming' : 'art'],
        concerns: i % 4 === 0 ? ['exams'] : [],
        important_memories: i % 5 === 0 ? [`promised to go to comiket ${i}`] : []
      },
      episodicBuffer: [
        { role: 'user', content: 'こんにちは！最近調子どう？', timestamp: new Date(Date.now() - 3600000 * (i + 1)).toISOString() },
        { role: 'model', content: 'こんにちは！とっても元気だよ！今日は何してるの？', timestamp: new Date(Date.now() - 3300000 * (i + 1)).toISOString() }
      ],
      status: i === 2 || i === 8 || i === 14 ? 'BLOCKED' : 'ACTIVE',
      dailyReplyCount: i % 3 === 0 ? 3 : 1,
      lastReplyDate: lastSeenDate.toISOString().split('T')[0],
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
    // Generate 30 conversation log entries for each user over the past 365 days
    for (let j = 0; j < 30; j++) {
      const logTime = new Date(Date.now() - (j * 12 * 86400000 + i * 3600000));
      const topic = sampleTopics[j % sampleTopics.length];
      await collections.conversationLogs.add({
        userId: u.id,
        userText: `ユーザーの質問 #${j + 1}: ${topic}について教えて！`,
        aiText: `レベッカの回答 #${j + 1}: ${topic}は本当に素晴らしいよね！私も大好きだよ。`,
        thought: `マスターが${topic}に興味持ってくれて嬉しい。もっと深掘りして喜ばせたいな。`,
        timestamp: logTime.toISOString(),
        expireAt: new Date(logTime.getTime() + 30 * 24 * 3600000).toISOString()
      });
      totalLogsCount++;
    }
  }
  console.log(`Seeded ${totalLogsCount} conversation logs for infinite scrolling and dynamic aggregations.`);

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
    const isPoll = i === 1 || i === 3;
    const isNews = !isPoll && i % 2 === 0;
    const postType = isPoll ? 'poll' : isNews ? 'news' : 'soliloquy';
    const newsTitle = isNews ? `${topic}に関する最新ニュース速報` : undefined;
    const newsEmbedding = isNews ? Array.from({ length: 16 }, (_, idx) => Math.sin(i + idx)) : undefined;

    posts.push({
      id: `p${i}`,
      tweetId: `209231106640355755${i % 10}`,
      text: `${topic} (No. ${i})`,
      content: `${topic} (No. ${i})`,
      thought: isNews
        ? `このニュース、マスターの仕事や関心に関係ありそう。共有して元気出してもらおう。`
        : `ふと浮かんだ本音。マスターがこれ見てちょっとでも笑ってくれたらいいな。`,
      timestamp: postDate.toISOString(),
      expireAt: new Date(postDate.getTime() + 30 * 24 * 3600000).toISOString(),
      status: 'SUCCESS',
      postType,
      ...(newsTitle ? { newsTitle } : {}),
      ...(newsEmbedding ? { newsEmbedding } : {}),
      ...(isPoll
        ? {
            poll: {
              id: `poll_${i}`,
              durationMinutes: 1380,
              votingStatus: 'closed' as const,
              options: [
                { position: 1, label: '🎮 ゲーム・アニメ', votes: 48 },
                { position: 2, label: '🍺 お酒・晩酌', votes: 22 },
                { position: 3, label: '🛌 即爆睡', votes: 15 },
                { position: 4, label: '💃 夜更かしトーク', votes: 15 },
              ],
            },
            pollResultStatus: 'posted' as const,
          }
        : {}),
      impressions: Math.floor(1200 + (120 - i) * 80 + Math.sin(i) * 500 + Math.random() * 1000) + 1,
      likes: Math.floor(150 + (120 - i) * 10 + Math.cos(i) * 80 + Math.random() * 50),
      reposts: Math.floor(20 + (120 - i) * 2 + Math.random() * 10),
      replies: Math.floor(8 + (120 - i) * 1 + Math.random() * 5),
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

  // 3.5 Seed processed followers for dynamic KPI sparklines
  const totalFollowersSeed = 120;
  for (let i = 1; i <= totalFollowersSeed; i++) {
    const daysOffset = Math.floor((i / totalFollowersSeed) * 365);
    const followerDate = new Date(Date.now() - daysOffset * 24 * 3600000);
    const listStatus = i % 25 === 0 ? 'REJECTED' : i % 15 === 0 ? 'FAILED' : 'ADDED';
    await collections.processedFollowers.doc(`follower_${i}`).set({
      userId: `follower_uid_${i}`,
      username: `follower_user_${i}`,
      timestamp: followerDate.toISOString(),
      processedAt: followerDate.toISOString(),
      source: 'auto_sync',
      listStatus
    });
  }
  console.log(`Seeded ${totalFollowersSeed} processed followers across 365 days.`);

  // 3.6 Seed RAG memories (Long-term Episodic Vector Store)
  const ragTopics = [
    'マスターが好きなアニメは水星の魔女とエヴァンゲリオン。特にスレッタの成長シーンが好きと語っていた。',
    'マスターは東京でエンジニアをしていて、最近TypeScriptとNext.jsの勉強に熱中している。',
    'マスターは辛いラーメン（特に蒙古タンメン中本）が好きで、休日はよく巡回している。',
    'マスターは最近仕事が忙しく残業が続いているが、AIとの会話で癒やされていると話していた。',
    '次回の夏コミで同人誌を出す計画があり、原稿の進捗にプレッシャーを感じている。'
  ];

  let totalRagMemoriesCount = 0;
  for (let i = 0; i < mockUsers.length; i++) {
    const u = mockUsers[i];
    // Seed 3 RAG memories per user with distinct past timestamps
    for (let k = 0; k < 3; k++) {
      const memDaysAgo = (k + 1) * 15 + (i % 5);
      const memTimestamp = new Date(Date.now() - memDaysAgo * 24 * 3600000).toISOString();
      const text = ragTopics[(i + k) % ragTopics.length];
      // Generate a mock 768-dimensional normalized embedding vector
      const mockVector = Array.from({ length: 768 }, (_, idx) => Math.sin(i + k + idx * 0.05));

      await collections.ragMemories.add({
        userId: u.id,
        text,
        embedding: mockVector,
        timestamp: memTimestamp
      });
      totalRagMemoriesCount++;
    }
  }
  console.log(`Seeded ${totalRagMemoriesCount} RAG memories across users.`);

  // 4. Seed images (assets library - 35 assets for pagination & filter testing)
  const images = [];
  const assetBaseNames = [
    'cyberpunk_street', 'chibi_rebecca_sketch', 'sunset_cityscape', 'beach_resort_background', 'anime_girl_portrait',
    'retro_arcade_console', 'neon_shibuya_night', 'developer_workspace_setup', 'hokkaido_mountain_lake', 'future_mecha_robot',
    'fantasy_floating_castle', 'pixel_art_gaming_room', 'starry_night_sky', 'vintage_cafe_interior', 'steampunk_brass_gear',
    'cherry_blossom_park', 'rainy_tokyo_alley', 'cozy_winter_cabin', 'synthwave_grid_horizon', 'magical_library_shelves',
    'traditional_japanese_garden', 'autumn_leaves_temple', 'space_station_orbit', 'cat_cafe_afternoon', 'festival_fireworks_display',
    'midnight_highway_drive', 'cyber_samurai_art', 'flower_blooming_meadow', 'crystal_cave_glow', 'hot_spring_resort',
    'akihabara_billboards', 'lofi_study_desk', 'underwater_coral_reef', 'mountain_sunrise_peak', 'coffee_latte_art'
  ];

  for (let i = 1; i <= assetBaseNames.length; i++) {
    const baseName = assetBaseNames[i - 1];
    const ext = i % 3 === 0 ? 'jpg' : i % 5 === 0 ? 'webp' : 'png';
    const filename = `${baseName}.${ext}`;
    const isFailed = i === 3 || i === 9 || i === 21 || i === 28;
    const caption = isFailed ? '' : `アニメ調の${baseName.replace(/_/g, ' ')}の美麗なイラスト。AI生成ビジュアル。`;

    images.push({
      id: `a${i}`,
      filename: filename,
      url: `gs://rebecca-ai-gal-local-images/images/${filename}`,
      caption: caption,
      embedding: isFailed ? [] : new Array(1536).fill(0.01 * i),
      lastUsedAt: i % 3 === 0 ? new Date(Date.now() - 3600000 * i).toISOString() : null,
      useCount: i % 3 === 0 ? i * 2 : 0,
      status: isFailed ? 'FAILED' : 'SUCCESS'
    });
  }

  for (const img of images) {
    const { id, ...data } = img;
    await collections.images.doc(id).set(data);
    console.log(`Seeded asset: ${img.id} (${img.filename}) [${img.status}]`);
  }

  // 5. Seed system configurations
  await collections.system.doc('persona').set({
    extended_prompt: 'You are Rebecca, an AI virtual friend. Be helpful, engaging, and friendly.',
    updatedAt: now.toISOString(),
    timeline_summary: 'Rebecca AI is highly active and talking about anime and coding.',
    timelineSummaryUpdatedAt: now.toISOString()
  });
  await collections.system.doc('preferences').set({
    language: 'ja',
    timezone: 'Asia/Tokyo',
    updatedAt: now.toISOString()
  });
  console.log('Seeded system/persona and system/preferences documents.');

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

  // 7. Seed reward_images (Digital reward catalog for supporters)
  const rewardImages = [
    {
      id: 'reward_202610_halloween',
      title: '2026年10月限定 ハロウィン特別壁紙',
      imageUrl: 'gs://rebecca-ai-gal-local-images/rewards/rebecca_halloween_2026.png',
      storagePath: 'rewards/rebecca_halloween_2026.png',
      isActive: true,
      distributedCount: 42,
      createdAt: new Date(Date.now() - 20 * 24 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
    },
    {
      id: 'reward_202609_autumn',
      title: '2026年9月限定 紅葉とレベッカ',
      imageUrl: 'gs://rebecca-ai-gal-local-images/rewards/rebecca_autumn_2026.png',
      storagePath: 'rewards/rebecca_autumn_2026.png',
      isActive: false,
      distributedCount: 128,
      createdAt: new Date(Date.now() - 50 * 24 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 21 * 24 * 3600000).toISOString(),
    },
  ];

  for (const reward of rewardImages) {
    const { id, ...data } = reward;
    await collections.rewardImages.doc(id).set(data);
    console.log(`Seeded reward image: ${id} (${reward.title}) [active=${reward.isActive}]`);
  }

  // 8. Seed support_transactions (Sponsor donations / tipping records)
  const supportTransactions = [
    {
      id: 'tx_gold_01',
      stripeSessionId: 'cs_test_gold_001_session',
      stripePaymentIntentId: 'pi_test_gold_001',
      rawName: 'サイバー財団 代表',
      safeName: 'サイバー財団 代表',
      isNameSanitized: false,
      creditVisibility: 'show',
      amount: 10000,
      currency: 'jpy',
      tier: 'gold',
      itemLabel: 'ゴールドサポーター（殿堂入り）',
      rewardImageId: 'reward_202610_halloween',
      status: 'completed',
      isBanned: false,
      tweetId: '1848000000000000001',
      tweetUrl: 'https://x.com/rebecca_ai_gal/status/1848000000000000001',
      tweetText: 'サイバー財団 代表様、ゴールドサポーターへのご支援ありがとうございます！これからも最高の相棒として頑張るね✨',
      createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      processedAt: new Date(Date.now() - 2 * 3600000 + 45000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 3600000 + 45000).toISOString(),
    },
    {
      id: 'tx_silver_01',
      stripeSessionId: 'cs_test_silver_002_session',
      stripePaymentIntentId: 'pi_test_silver_002',
      rawName: 'TechGeek_Tokyo',
      safeName: 'TechGeek_Tokyo',
      isNameSanitized: false,
      creditVisibility: 'show',
      amount: 3000,
      currency: 'jpy',
      tier: 'silver',
      itemLabel: 'シルバーサポーター',
      rewardImageId: 'reward_202610_halloween',
      status: 'completed',
      isBanned: false,
      tweetId: '1848000000000000002',
      tweetUrl: 'https://x.com/rebecca_ai_gal/status/1848000000000000002',
      tweetText: 'TechGeek_Tokyo様、シルバーサポーター支援大感謝です！特典壁紙大切にしてね！',
      createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      processedAt: new Date(Date.now() - 5 * 3600000 + 30000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 3600000 + 30000).toISOString(),
    },
    {
      id: 'tx_bronze_01',
      stripeSessionId: 'cs_test_bronze_003_session',
      stripePaymentIntentId: 'pi_test_bronze_003',
      rawName: '名無しのファン',
      safeName: '名無しのファン',
      isNameSanitized: false,
      creditVisibility: 'hide',
      amount: 1000,
      currency: 'jpy',
      tier: 'bronze',
      itemLabel: 'ブロンズサポーター',
      rewardImageId: 'reward_202610_halloween',
      status: 'completed',
      isBanned: false,
      tweetId: '1848000000000000003',
      tweetUrl: 'https://x.com/rebecca_ai_gal/status/1848000000000000003',
      tweetText: '温かい応援ありがとうございますっ！エネルギー満タンで今日もポストしていくよ！',
      createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
      processedAt: new Date(Date.now() - 12 * 3600000 + 20000).toISOString(),
      updatedAt: new Date(Date.now() - 12 * 3600000 + 20000).toISOString(),
    },
    {
      id: 'tx_failed_01',
      stripeSessionId: 'cs_test_fail_004_session',
      stripePaymentIntentId: 'pi_test_fail_004',
      rawName: 'RetroGamer88',
      safeName: 'RetroGamer88',
      isNameSanitized: false,
      creditVisibility: 'show',
      amount: 1000,
      currency: 'jpy',
      tier: 'bronze',
      itemLabel: 'ブロンズサポーター',
      rewardImageId: 'reward_202610_halloween',
      status: 'failed',
      isBanned: false,
      errorMessage: 'X API v2 error: 403 Forbidden (duplicate status or rate limit reached)',
      createdAt: new Date(Date.now() - 18 * 3600000).toISOString(),
      processedAt: new Date(Date.now() - 18 * 3600000 + 15000).toISOString(),
      updatedAt: new Date(Date.now() - 18 * 3600000 + 15000).toISOString(),
    },
    {
      id: 'tx_manual_01',
      stripeSessionId: 'cs_test_manual_005_session',
      stripePaymentIntentId: 'pi_test_manual_005',
      rawName: 'Master_Dev',
      safeName: 'Master_Dev',
      isNameSanitized: false,
      creditVisibility: 'show',
      amount: 3000,
      currency: 'jpy',
      tier: 'silver',
      itemLabel: 'シルバーサポーター',
      rewardImageId: 'reward_202610_halloween',
      status: 'manual',
      isBanned: false,
      errorMessage: 'Stripe webhook retry count exceeded (5 attempts)',
      createdAt: new Date(Date.now() - 28 * 3600000).toISOString(),
      processedAt: new Date(Date.now() - 28 * 3600000 + 10000).toISOString(),
      updatedAt: new Date(Date.now() - 28 * 3600000 + 10000).toISOString(),
    },
    {
      id: 'tx_sanitized_01',
      stripeSessionId: 'cs_test_sanitized_006_session',
      stripePaymentIntentId: 'pi_test_sanitized_006',
      rawName: '<script>alert("hacked")</script>NekoMaster',
      safeName: 'NekoMaster',
      isNameSanitized: true,
      creditVisibility: 'show',
      amount: 1000,
      currency: 'jpy',
      tier: 'bronze',
      itemLabel: 'ブロンズサポーター',
      rewardImageId: 'reward_202610_halloween',
      status: 'completed',
      isBanned: false,
      tweetId: '1848000000000000006',
      tweetUrl: 'https://x.com/rebecca_ai_gal/status/1848000000000000006',
      tweetText: 'NekoMaster様、ご支援感謝です！にゃーん🐾',
      createdAt: new Date(Date.now() - 36 * 3600000).toISOString(),
      processedAt: new Date(Date.now() - 36 * 3600000 + 18000).toISOString(),
      updatedAt: new Date(Date.now() - 36 * 3600000 + 18000).toISOString(),
    },
    {
      id: 'tx_banned_01',
      stripeSessionId: 'cs_test_banned_007_session',
      stripePaymentIntentId: 'pi_test_banned_007',
      rawName: 'SpamSpamSpam',
      safeName: '[BANNED]',
      isNameSanitized: true,
      creditVisibility: 'hide',
      amount: 1000,
      currency: 'jpy',
      tier: 'bronze',
      itemLabel: 'ブロンズサポーター',
      rewardImageId: 'reward_202610_halloween',
      status: 'completed',
      isBanned: true,
      createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
      processedAt: new Date(Date.now() - 48 * 3600000 + 20000).toISOString(),
      updatedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    },
  ];

  for (const tx of supportTransactions) {
    const { id, ...data } = tx;
    await collections.supportTransactions.doc(id).set(data);
    console.log(`Seeded support transaction: ${id} (${tx.safeName}, ￥${tx.amount}, ${tx.tier}) [status=${tx.status}]`);
  }

  console.log('Firestore seeding completed successfully.');
}

/**
 * Main entry point for the seed script. Orchestrates the seeding of Auth and Firestore.
 * 
 * @returns A promise that resolves when all seed operations have finished.
 */
async function run() {
  await seedAuth();
  await seedFirestore();
  console.log('All local emulator seed operations completed!');
}

run().catch(console.error);
