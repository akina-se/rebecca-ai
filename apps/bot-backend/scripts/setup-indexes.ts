/**
 * @fileoverview Automated setup script for Firestore indexes and TTL policies.
 * 
 * Configures all required composite indexes (vector search, complex queries)
 * and Time-to-Live (TTL) policies for the Rebecca AI database in GCP.
 * 
 * Usage:
 *   npm run setup:indexes
 */

import { spawnSync } from 'child_process';
import 'dotenv/config';

const rawProjectId = process.env.GCP_PROJECT_ID || '';
const rawDatabase = process.env.FIRESTORE_DATABASE || '(default)';

// Sanitize and validate inputs against strict pattern to prevent command injection
if (!rawProjectId || !/^[a-zA-Z0-9-_]+$/.test(rawProjectId)) {
    console.error('❌ Error: GCP_PROJECT_ID is invalid or not set in environment or .env');
    process.exit(1);
}

if (!/^[a-zA-Z0-9-_()]+$/.test(rawDatabase)) {
    console.error('❌ Error: FIRESTORE_DATABASE contains invalid characters');
    process.exit(1);
}

const projectId = rawProjectId;
const database = rawDatabase;

console.log(`=======================================================`);
console.log(` 🔥 Setting up Firestore Indexes for Project: ${projectId}`);
console.log(`=======================================================\n`);

interface IndexDefinition {
    collectionGroup: string;
    description: string;
    fields: {
        fieldPath: string;
        order?: 'ascending' | 'descending';
        vectorConfig?: { dimension: number; flat: Record<string, never> };
    }[];
}

const indexes: IndexDefinition[] = [
    {
        collectionGroup: 'images',
        description: 'Vector search for semantic image matching',
        fields: [
            {
                fieldPath: 'embedding',
                vectorConfig: { dimension: 768, flat: {} }
            }
        ]
    },
    {
        collectionGroup: 'rag_memories',
        description: 'User-scoped vector search for RAG memory retrieval',
        fields: [
            {
                fieldPath: 'userId',
                order: 'ascending'
            },
            {
                fieldPath: 'embedding',
                vectorConfig: { dimension: 768, flat: {} }
            }
        ]
    },
    {
        collectionGroup: 'rag_memories',
        description: 'User-scoped timestamp sorting for memory pruning',
        fields: [
            {
                fieldPath: 'userId',
                order: 'ascending'
            },
            {
                fieldPath: 'timestamp',
                order: 'ascending'
            }
        ]
    },
    {
        collectionGroup: 'processed_followers',
        description: 'Index for querying failed follower onboarding by timestamp for FIFO retries',
        fields: [
            {
                fieldPath: 'listStatus',
                order: 'ascending'
            },
            {
                fieldPath: 'timestamp',
                order: 'ascending'
            }
        ]
    }
];

const ttlPolicies = [
    {
        collectionGroup: 'conversation_logs',
        field: 'expireAt',
        description: '5-year automatic expiration for raw conversation logs'
    },
    {
        collectionGroup: 'timeline_history',
        field: 'expireAt',
        description: '5-year automatic expiration for timeline post history'
    }
];

const createIndex = (idx: IndexDefinition) => {
    console.log(`📌 Processing Index: [${idx.collectionGroup}] - ${idx.description}...`);
    
    const args = [
        'firestore', 'indexes', 'composite', 'create',
        `--project=${projectId}`,
        `--database=${database}`,
        `--collection-group=${idx.collectionGroup}`,
        '--query-scope=COLLECTION',
        '--async'
    ];

    for (const f of idx.fields) {
        if (f.vectorConfig) {
            args.push(`--field-config=field-path=${f.fieldPath},vector-config={dimension=${f.vectorConfig.dimension},flat={}}`);
        } else {
            args.push(`--field-config=field-path=${f.fieldPath},order=${f.order || 'ascending'}`);
        }
    }

    try {
        const result = spawnSync('gcloud', args, { encoding: 'utf-8', shell: process.platform === 'win32' });
        const stderr = result.stderr ? result.stderr.toString() : '';
        if (result.status !== 0) {
            if (stderr.includes('ALREADY_EXISTS') || stderr.includes('already exists')) {
                console.log(`  ℹ️  Index already exists. Skipping.`);
            } else {
                console.warn(`  ⚠️ Warning/Note: ${stderr.trim() || result.error?.message}`);
            }
        } else {
            console.log(`  ✅ Index creation request issued successfully.`);
        }
    } catch (e: unknown) {
        const err = e as { message?: string };
        console.warn(`  ⚠️ Warning/Note: ${err.message}`);
    }
};

const setupTtl = (ttl: { collectionGroup: string; field: string; description: string }) => {
    console.log(`⏳ Setting up TTL Policy: [${ttl.collectionGroup}.${ttl.field}] - ${ttl.description}...`);
    const args = [
        'firestore', 'fields', 'ttls', 'update',
        ttl.field,
        `--collection-group=${ttl.collectionGroup}`,
        `--project=${projectId}`,
        `--database=${database}`,
        '--enable-ttl',
        '--async'
    ];

    try {
        const result = spawnSync('gcloud', args, { encoding: 'utf-8', shell: process.platform === 'win32' });
        const stderr = result.stderr ? result.stderr.toString() : '';
        if (result.status !== 0) {
            if (stderr.includes('ALREADY_EXISTS') || stderr.includes('already exists') || stderr.includes('TTL is already enabled')) {
                console.log(`  ℹ️  TTL policy already active. Skipping.`);
            } else {
                console.warn(`  ⚠️ Note: ${stderr.trim() || result.error?.message}`);
            }
        } else {
            console.log(`  ✅ TTL policy configured.`);
        }
    } catch (e: unknown) {
        const err = e as { message?: string };
        console.warn(`  ⚠️ Note: ${err.message}`);
    }
};

console.log('--- 1. Composite & Vector Indexes ---');
indexes.forEach(createIndex);

console.log('\n--- 2. TTL (Time-To-Live) Policies ---');
ttlPolicies.forEach(setupTtl);

console.log('\n=======================================================');
console.log(' ✨ Firestore setup process completed.');
console.log(' Current index build statuses can be viewed with:');
console.log('   gcloud firestore indexes composite list');
console.log('=======================================================\n');
