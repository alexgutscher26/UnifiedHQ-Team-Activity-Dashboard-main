const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function testTeamActivityAPI() {
  try {
    console.log('🧪 Testing Team Activity API directly...\n');

    // Get the first user
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('❌ No user found');
      return;
    }

    console.log(`👤 Testing with user: ${user.name} (${user.email})`);

    // Simulate the team activity API logic
    console.log('\n📡 Testing fetchGithubActivity...');

    // Import the function dynamically
    const { fetchGithubActivity } = await import(
      '../src/lib/integrations/github-cached.ts'
    );

    try {
      const githubActivities = await fetchGithubActivity(user.id);
      console.log(
        `✅ fetchGithubActivity returned ${githubActivities.length} activities`
      );

      if (githubActivities.length > 0) {
        console.log('📋 Sample activities:');
        githubActivities.slice(0, 3).forEach((activity, index) => {
          console.log(`  ${index + 1}. ${activity.title}`);
          console.log(`     Type: ${activity.metadata?.eventType}`);
          console.log(`     Repo: ${activity.metadata?.repo?.name}`);
          console.log(`     Time: ${activity.timestamp}`);
        });
      } else {
        console.log('⚠️  No activities returned from fetchGithubActivity');
      }
    } catch (error) {
      console.log(`❌ fetchGithubActivity failed: ${error.message}`);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testTeamActivityAPI().catch(console.error);
