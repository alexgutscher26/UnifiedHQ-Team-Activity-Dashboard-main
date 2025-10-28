const { PrismaClient } = require('../src/generated/prisma')

const prisma = new PrismaClient()

async function testGitHubAPI () {
  try {
    console.log('🔍 Testing GitHub API Access...\n')

    // Get user and connection
    const user = await prisma.user.findFirst()
    if (!user) {
      console.log('❌ No user found')
      return
    }

    const connection = await prisma.connection.findFirst({
      where: {
        userId: user.id,
        type: 'github'
      }
    })

    if (!connection) {
      console.log('❌ No GitHub connection found')
      return
    }

    console.log(`✅ GitHub connection found for user: ${user.name}`)

    // Test GitHub API directly
    const { Octokit } = require('@octokit/rest')
    const octokit = new Octokit({
      auth: connection.accessToken,
      userAgent: 'UnifiedHQ/1.0.0'
    })

    try {
      // Test rate limit
      console.log('\n📊 Checking rate limit...')
      const rateLimit = await octokit.rest.rateLimit.get()
      console.log(
        `Rate limit: ${rateLimit.data.rate.remaining}/${rateLimit.data.rate.limit}`
      )

      if (rateLimit.data.rate.remaining < 10) {
        console.log('⚠️  Low rate limit remaining!')
      }

      // Test user info
      console.log('\n👤 Getting user info...')
      const userInfo = await octokit.rest.users.getAuthenticated()
      console.log(
        `GitHub user: ${userInfo.data.login} (${userInfo.data.name})`
      )

      // Test repositories
      console.log('\n📁 Getting repositories...')
      const repos = await octokit.rest.repos.listForAuthenticatedUser({
        per_page: 5,
        sort: 'updated'
      })
      console.log(`Found ${repos.data.length} repositories`)

      // Test commits for first repo
      if (repos.data.length > 0) {
        const repo = repos.data[0]
        console.log(`\n🔍 Testing commits for ${repo.full_name}...`)

        try {
          const commits = await octokit.rest.repos.listCommits({
            owner: repo.owner.login,
            repo: repo.name,
            per_page: 5
          })
          console.log(`✅ Found ${commits.data.length} commits`)

          if (commits.data.length > 0) {
            const commit = commits.data[0]
            console.log(
              `Sample commit: ${commit.commit.message.split('\n')[0]}`
            )
            console.log(`Author: ${commit.commit.author?.name || 'Unknown'}`)
            console.log(
              `Date: ${commit.commit.author?.date || commit.commit.committer?.date}`
            )
          }
        } catch (commitError) {
          console.log(`❌ Failed to get commits: ${commitError.message}`)
        }
      }
    } catch (apiError) {
      console.log(`❌ GitHub API error: ${apiError.message}`)
      if (apiError.status === 401) {
        console.log('🔑 Token might be expired or invalid')
      } else if (apiError.status === 403) {
        console.log('🚫 Rate limit exceeded or insufficient permissions')
      }
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testGitHubAPI().catch(console.error)
