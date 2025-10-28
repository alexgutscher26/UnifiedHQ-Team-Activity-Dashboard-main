const { PrismaClient } = require('../src/generated/prisma')
const {
  fetchGithubActivity
} = require('../src/lib/integrations/github-cached')

const prisma = new PrismaClient()

async function testTeamActivity () {
  try {
    console.log('🧪 Testing Team Activity API...\n')

    // Get the first user
    const user = await prisma.user.findFirst()
    if (!user) {
      console.log('❌ No user found')
      return
    }

    console.log(`👤 Testing with user: ${user.name} (${user.email})`)

    // Test fetchGithubActivity directly
    console.log('\n📡 Testing fetchGithubActivity...')
    try {
      const activities = await fetchGithubActivity(user.id)
      console.log(
        `✅ fetchGithubActivity returned ${activities.length} activities`
      )

      if (activities.length > 0) {
        console.log('📋 Sample activity:')
        const sample = activities[0]
        console.log(`  - Title: ${sample.title}`)
        console.log(`  - Type: ${sample.metadata?.eventType}`)
        console.log(`  - Repo: ${sample.metadata?.repo?.name}`)
        console.log(`  - Timestamp: ${sample.timestamp}`)
      }
    } catch (error) {
      console.log(`❌ fetchGithubActivity failed: ${error.message}`)
    }

    // Test the transformation logic
    console.log('\n🔄 Testing transformation logic...')
    try {
      const activities = await fetchGithubActivity(user.id)

      const teamActivities = activities.map((activity, index) => {
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
          timestamp: activity.timestamp.toISOString(),
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

      if (teamActivities.length > 0) {
        console.log('📋 Sample transformed activity:')
        const sample = teamActivities[0]
        console.log(`  - ID: ${sample.id}`)
        console.log(`  - Type: ${sample.type}`)
        console.log(`  - Title: ${sample.title}`)
        console.log(`  - Repository: ${sample.repository}`)
        console.log(`  - Author: ${sample.author.name}`)
        console.log(`  - Timestamp: ${sample.timestamp}`)
      }

      // Test time filtering
      console.log('\n⏰ Testing time filtering...')
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
    } catch (error) {
      console.log(`❌ Transformation failed: ${error.message}`)
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testTeamActivity().catch(console.error)
