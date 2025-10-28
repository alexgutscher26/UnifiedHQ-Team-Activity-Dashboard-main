const { PrismaClient } = require('../src/generated/prisma')

const prisma = new PrismaClient()

async function testFetchGithubActivity () {
  try {
    console.log('🧪 Testing fetchGithubActivity function...\n')

    // Get the first user
    const user = await prisma.user.findFirst()
    if (!user) {
      console.log('❌ No user found')
      return
    }

    console.log(`👤 Testing with user: ${user.name} (${user.email})`)

    // Get selected repositories
    const selectedRepos = await prisma.selectedRepository.findMany({
      where: {
        userId: user.id
      }
    })

    console.log(`📁 Found ${selectedRepos.length} selected repositories`)

    // Generate cache key like the function does
    const cacheKey = `activities:${user.id}:${selectedRepos
      .map(r => r.repoId)
      .sort()
      .join(',')}`

    console.log(`🔑 Cache key: ${cacheKey}`)

    // Check if there's cached data
    const cachedActivities = await prisma.gitHubCache.findUnique({
      where: {
        userId_cacheKey: {
          userId: user.id,
          cacheKey
        }
      }
    })

    if (cachedActivities) {
      console.log('✅ Found cached activities')
      console.log(`   Count: ${cachedActivities.data.length}`)
      console.log(`   Timestamp: ${cachedActivities.timestamp}`)
      console.log(`   TTL: ${cachedActivities.ttl}`)
    } else {
      console.log('❌ No cached activities found')
    }

    // Test GitHub API access for first repo
    if (selectedRepos.length > 0) {
      const repo = selectedRepos[0]
      const [owner, repoName] = repo.repoName.split('/')

      console.log(`\n🔍 Testing GitHub API for ${owner}/${repoName}...`)

      const connection = await prisma.connection.findFirst({
        where: {
          userId: user.id,
          type: 'github'
        }
      })

      if (connection) {
        const { Octokit } = require('@octokit/rest')
        const octokit = new Octokit({
          auth: connection.accessToken,
          userAgent: 'UnifiedHQ/1.0.0'
        })

        try {
          const commits = await octokit.rest.repos.listCommits({
            owner,
            repo: repoName,
            per_page: 5
          })

          console.log(`✅ Found ${commits.data.length} commits`)

          if (commits.data.length > 0) {
            const commit = commits.data[0]
            console.log(`   Latest: ${commit.commit.message.split('\n')[0]}`)
            console.log(
              `   Author: ${commit.commit.author?.name || 'Unknown'}`
            )
            console.log(
              `   Date: ${commit.commit.author?.date || commit.commit.committer?.date}`
            )
          }
        } catch (apiError) {
          console.log(`❌ GitHub API error: ${apiError.message}`)
          if (apiError.status === 404) {
            console.log('   Repository might not exist or be accessible')
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testFetchGithubActivity().catch(console.error)
