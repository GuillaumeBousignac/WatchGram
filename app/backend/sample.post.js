// Add Sample Posts to Database with Placeholder Likes
// Run this with: node addSamplePosts.js

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'watchgram_user',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'watchgram'
});

const samplePosts = [
  {
    name: "Rolex Submariner",
    brand: "Rolex",
    price: 8500,
    diameter: 41,
    thickness: 12.5,
    waterResistance: 300,
    movement: "Automatique",
    material: "Acier inoxydable",
    minLikes: 800,  // Minimum likes
    maxLikes: 1500, // Maximum likes
    images: [
      "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?w=800&h=800&fit=crop"
    ]
  },
  {
    name: "Omega Speedmaster",
    brand: "Omega",
    price: 6200,
    diameter: 42,
    thickness: 13.2,
    waterResistance: 50,
    movement: "Chronographe automatique",
    material: "Acier",
    minLikes: 600,
    maxLikes: 1200,
    images: [
      "https://images.unsplash.com/photo-1594534475808-b18fc33b045e?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1622434641406-a158123450f9?w=800&h=800&fit=crop"
    ]
  },
  {
    name: "TAG Heuer Carrera",
    brand: "TAG Heuer",
    price: 4800,
    diameter: 39,
    thickness: 11.8,
    waterResistance: 100,
    movement: "Automatique",
    material: "Acier et céramique",
    minLikes: 400,
    maxLikes: 900,
    images: [
      "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1533139502658-0198f920d8e8?w=800&h=800&fit=crop"
    ]
  },
  {
    name: "Seiko Presage",
    brand: "Seiko",
    price: 450,
    diameter: 40,
    thickness: 11.3,
    waterResistance: 50,
    movement: "Automatique",
    material: "Acier inoxydable",
    minLikes: 300,
    maxLikes: 700,
    images: [
      "https://images.unsplash.com/photo-1509048191080-d2984bad6ae5?w=800&h=800&fit=crop"
    ]
  }
];

// Fake user data for placeholder likes
const fakeUsers = [
  { username: 'watchlover92', email: 'watchlover92@example.com' },
  { username: 'luxurywatch', email: 'luxurywatch@example.com' },
  { username: 'moonwatch', email: 'moonwatch@example.com' },
  { username: 'collector_time', email: 'collector@example.com' },
  { username: 'racer_watch', email: 'racer@example.com' },
  { username: 'affordable_lux', email: 'affordable@example.com' },
  { username: 'timepiece_fan', email: 'timepiece@example.com' },
  { username: 'watch_enthusiast', email: 'enthusiast@example.com' },
  { username: 'horologist', email: 'horologist@example.com' },
  { username: 'swiss_collector', email: 'swiss@example.com' }
];

// Helper function to generate random number between min and max
function getRandomLikes(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function createFakeUsers() {
  const userIds = [];
  
  for (const user of fakeUsers) {
    try {
      // Check if user already exists
      const [[existing]] = await db.query(
        'SELECT id FROM users WHERE email = ?',
        [user.email]
      );
      
      if (existing) {
        userIds.push(existing.id);
      } else {
        // Create fake user with dummy password hash
        const [result] = await db.query(
          'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
          [user.username, user.email, '$2b$10$dummyHashForPlaceholderUsers']
        );
        userIds.push(result.insertId);
      }
    } catch (error) {
      console.error(`Error creating user ${user.username}:`, error.message);
    }
  }
  
  return userIds;
}

async function addPlaceholderLikes(postId, likesCount, userIds) {
  // Add random likes from fake users
  const shuffled = [...userIds].sort(() => 0.5 - Math.random());
  const selectedUsers = shuffled.slice(0, Math.min(likesCount, userIds.length));
  
  for (const userId of selectedUsers) {
    try {
      await db.query(
        'INSERT IGNORE INTO likes (user_id, post_id) VALUES (?, ?)',
        [userId, postId]
      );
    } catch (error) {
      // Ignore duplicate errors
    }
  }
  
  // If we need more likes than fake users, add some multiple times (not realistic but fills the count)
  if (likesCount > userIds.length) {
    const remaining = likesCount - userIds.length;
    for (let i = 0; i < remaining; i++) {
      const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
      try {
        await db.query(
          'INSERT IGNORE INTO likes (user_id, post_id) VALUES (?, ?)',
          [randomUserId, postId]
        );
      } catch (error) {
        // Ignore errors
      }
    }
  }
}

async function addSamplePosts() {
  try {
    console.log('🔄 Creating fake users for placeholder likes...');
    const userIds = await createFakeUsers();
    console.log(`✅ Created/found ${userIds.length} fake users`);
    
    console.log('\n🔄 Adding sample posts to database...');
    
    for (const post of samplePosts) {
      // Generate random number of likes
      const randomLikes = getRandomLikes(post.minLikes, post.maxLikes);
      
      // Insert post
      const [result] = await db.query(`
        INSERT INTO posts (
          user_id, name, brand, price, diameter, 
          thickness, water_resistance, movement, material
        ) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        post.name,
        post.brand,
        post.price,
        post.diameter,
        post.thickness,
        post.waterResistance,
        post.movement,
        post.material
      ]);

      const postId = result.insertId;

      // Insert images
      for (let i = 0; i < post.images.length; i++) {
        await db.query(
          'INSERT INTO post_images (post_id, image_url, position) VALUES (?, ?, ?)',
          [postId, post.images[i], i]
        );
      }
      
      // Add random placeholder likes
      if (randomLikes > 0) {
        await addPlaceholderLikes(postId, randomLikes, userIds);
        console.log(`✅ Added: ${post.name} (${randomLikes} likes)`);
      } else {
        console.log(`✅ Added: ${post.name}`);
      }
    }

    console.log('\n🎉 All sample posts added successfully!');
    console.log('📊 Total posts added:', samplePosts.length);
    console.log('👥 Fake users created for likes:', userIds.length);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding sample posts:', error);
    process.exit(1);
  }
}

addSamplePosts();