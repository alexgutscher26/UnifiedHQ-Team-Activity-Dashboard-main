const { PrismaClient } = require('../src/generated/prisma')

const prisma = new PrismaClient()

async function testTeamActivityTransformation () {
  try {
    console.log('🧪 Testing Team Activity Transformation...\n')

    // Get the first user
    const user = await prisma.user.findFirst()
    if (!user) {
      console.log('❌ No user found')
      return
    }

    console.log(`👤 Testing with user: ${user.name} (${user.email})`)

    // Get cached activities
    const selectedRepos = await prisma.selectedRepository.findMany({
      where: { userId: user.id }
    })

    const cacheKey =
      'activities:' +
      user.id +
      ':' +
      selectedRepos
        .map(r => r.repoId)
        .sort()
        .join(',')

    const cachedActivities = await prisma.gitHubCache.findUnique({
      where: {
        userId_cacheKey: {
          userId: user.id,
          cacheKey
        }
      }
    })

    if (!cachedActivities || !cachedActivities.data) {
      console.log('❌ No cached activities found')
      return
    }

    console.log(`✅ Found ${cachedActivities.data.length} cached activities`)

    // Simulate the transformation logic from team activity API
    const githubActivities = cachedActivities.data
    const teamActivities = githubActivities.map((activity, index) => {
      const eventType = activity.metadata?.eventType || 'commit'
      const repoInfo = activity.metadata?.repo
      const actor = activity.metadata?.actor

      return {
        id: `activity-${activity.externalId || index}`,
        type: eventType,
        title: activity.title || 'Untitled Activity',
        description: activity.description,
        author: {
          id: user.id,
          name: user.name || 'Unknown User',
          email: user.email || '',
          avatar: user.image,
          role: 'Developer',
          status: 'active',
          lastActive: new Date().toISOString(),
          commits: eventType === 'commit' ? 1 : 0,
          pullRequests: eventType === 'pull_request' ? 1 : 0,
          issues: eventType === 'issue' ? 1 : 0,
          reviews: eventType === 'review' ? 1 : 0
        },
        repository: repoInfo?.name || 'Unknown Repository',
        timestamp: activity.timestamp,
        status:
          activity.metadata?.payload?.pull_request?.state ||
          activity.metadata?.payload?.issue?.state ||
          'open',
        url:
          activity.metadata?.payload?.commit?.url ||
          activity.metadata?.payload?.pull_request?.html_url ||
          activity.metadata?.payload?.issue?.html_url,
        metadata: activity.metadata
      }
    })

    console.log(`✅ Transformed ${teamActivities.length} activities`)

    // Test time filtering
    const now = new Date()
    const timeRangeDays = 30
    const cutoffDate = new Date(
      now.getTime() - timeRangeDays * 24 * 60 * 60 * 1000
    )

    const filteredActivities = teamActivities.filter(
      activity => new Date(activity.timestamp) >= cutoffDate
    )

    console.log(
      `✅ Time filtering: ${teamActivities.length} → ${filteredActivities.length} activities`
    )

    if (filteredActivities.length > 0) {
      console.log('\n📋 Sample transformed activities:')
      filteredActivities.slice(0, 3).forEach((activity, index) => {
        console.log(`${index + 1}. ${activity.title}`)
        console.log(`   Type: ${activity.type}`)
        console.log(`   Repository: ${activity.repository}`)
        console.log(`   Author: ${activity.author.name}`)
        console.log(`   Timestamp: ${activity.timestamp}`)
        console.log('')
      })
    } else {
      console.log('⚠️  No activities after time filtering')
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testTeamActivityTransformation().catch(console.error)
