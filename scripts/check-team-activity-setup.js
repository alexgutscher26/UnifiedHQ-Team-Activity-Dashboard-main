#!/usr/bin/env node

/**
 * Team Activity Setup Checker
 *
 * This script helps diagnose why team activity might not be showing
 * and provides guidance on how to fix the issue.
 */

const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function checkTeamActivitySetup() {
  console.log('🔍 Checking Team Activity Setup...\n');

  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (users.length === 0) {
      console.log('❌ No users found in the database');
      return;
    }

    console.log(`👥 Found ${users.length} user(s)\n`);

    for (const user of users) {
      console.log(
        `📋 Checking user: ${user.name || 'Unknown'} (${user.email})`
      );

      // Check GitHub connection
      const githubConnection = await prisma.connection.findFirst({
        where: {
          userId: user.id,
          type: 'github',
        },
      });

      if (!githubConnection) {
        console.log('  ❌ GitHub not connected');
        console.log('     → Go to /integrations to connect GitHub');
        continue;
      }

      console.log('  ✅ GitHub connected');

      // Check selected repositories
      const selectedRepos = await prisma.selectedRepository.findMany({
        where: {
          userId: user.id,
        },
      });

      if (selectedRepos.length === 0) {
        console.log('  ❌ No repositories selected');
        console.log(
          '     → Go to /integrations and select repositories to track'
        );
        continue;
      }

      console.log(`  ✅ ${selectedRepos.length} repository(ies) selected:`);
      selectedRepos.forEach(repo => {
        console.log(`     - ${repo.repoName}`);
      });

      // Check activities
      const activities = await prisma.activity.findMany({
        where: {
          userId: user.id,
          source: 'github',
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: 5,
      });

      if (activities.length === 0) {
        console.log('  ⚠️  No activities found');
        console.log('     → Try syncing GitHub data in /integrations');
      } else {
        console.log(`  ✅ ${activities.length} activities found`);
        console.log('     Recent activities:');
        activities.slice(0, 3).forEach(activity => {
          console.log(`     - ${activity.title}`);
        });
      }

      console.log('');
    }

    console.log('🎯 Summary:');
    console.log('1. Connect GitHub account at /integrations');
    console.log('2. Select repositories to track');
    console.log('3. Sync data to see activities');
    console.log('4. Visit /team-activity to view team dashboard');
  } catch (error) {
    console.error('❌ Error checking setup:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkTeamActivitySetup().catch(console.error);
