#!/usr/bin/env node

/**
 * Daily Summary Troubleshooting Script
 * Helps diagnose why daily summaries aren't generating
 */

const { PrismaClient } = require('../src/generated/prisma')

const prisma = new PrismaClient()

async function troubleshootDailySummary () {
  console.log('🔍 Daily Summary Troubleshooting')
  console.log('================================\n')

  try {
    // 1. Check if we have any users
    console.log('1. Checking users...')
    const userCount = await prisma.user.count()
    console.log(`   Total users: ${userCount}`)

    if (userCount === 0) {
      console.log('   ❌ No users found in database')
      return
    }

    // 2. Check recent activity (last 24 hours)
    console.log('\n2. Checking recent activity...')
    const now = new Date()
    const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const recentActivityCount = await prisma.activity.count({
      where: {
        timestamp: {
          gte: startDate
        }
      }
    })
    console.log(`   Activities in last 24 hours: ${recentActivityCount}`)

    // 3. Check users with recent activity
    console.log('\n3. Checking users with recent activity...')
    const usersWithActivity = await prisma.user.findMany({
      where: {
        activities: {
          some: {
            timestamp: {
              gte: startDate
            }
          }
        }
      },
      include: {
        activities: {
          where: {
            timestamp: {
              gte: startDate
            }
          }
        },
        aiSummaries: {
          orderBy: {
            generatedAt: 'desc'
          },
          take: 1
        }
      }
    })

    console.log(`   Users with recent activity: ${usersWithActivity.length}`)

    // 4. Check each user's eligibility
    console.log('\n4. Checking user eligibility...')
    let eligibleUsers = 0
    let usersWithEnoughActivity = 0
    let usersWithoutRecentSummary = 0

    for (const user of usersWithActivity) {
      const activityCount = user.activities.length
      const lastSummary = user.aiSummaries[0]
      const hasRecentSummary =
        lastSummary &&
        lastSummary.generatedAt > new Date(now.getTime() - 24 * 60 * 60 * 1000)

      console.log(`   User ${user.id}:`)
      console.log(`     - Activities (last 24h): ${activityCount}`)
      console.log(
        `     - Last summary: ${lastSummary ? lastSummary.generatedAt.toISOString() : 'None'}`
      )
      console.log(
        `     - Has recent summary: ${hasRecentSummary ? 'Yes' : 'No'}`
      )

      if (activityCount >= 3) {
        usersWithEnoughActivity++
      }

      if (!hasRecentSummary) {
        usersWithoutRecentSummary++
      }

      if (activityCount >= 3 && !hasRecentSummary) {
        eligibleUsers++
        console.log('     ✅ ELIGIBLE for summary generation')
      } else {
        console.log('     ❌ Not eligible:')
        if (activityCount < 3) {
          console.log(
            `       - Need at least 3 activities (has ${activityCount})`
          )
        }
        if (hasRecentSummary) {
          console.log('       - Already has recent summary')
        }
      }
      console.log('')
    }

    // 5. Check AI summaries table
    console.log('5. Checking AI summaries...')
    const totalSummaries = await prisma.aISummary.count()
    const recentSummaries = await prisma.aISummary.count({
      where: {
        generatedAt: {
          gte: startDate
        }
      }
    })
    console.log(`   Total summaries: ${totalSummaries}`)
    console.log(`   Summaries in last 24h: ${recentSummaries}`)

    // 6. Check monitoring data
    console.log('\n6. Checking monitoring data...')
    try {
      const monitoringCount = await prisma.aISummaryMonitoring.count()
      const recentMonitoring = await prisma.aISummaryMonitoring.findMany({
        where: {
          createdAt: {
            gte: startDate
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      })

      console.log(`   Total monitoring records: ${monitoringCount}`)
      console.log(`   Recent monitoring records: ${recentMonitoring.length}`)

      if (recentMonitoring.length > 0) {
        console.log('   Recent monitoring data:')
        recentMonitoring.forEach(record => {
          console.log(
            `     - ${record.createdAt.toISOString()}: ${record.type} - ${record.status}`
          )
          console.log(
            `       Processed: ${record.processed}, Generated: ${record.generated}, Errors: ${record.errors}`
          )
        })
      }
    } catch (error) {
      console.log(`   ⚠️ Monitoring table not found: ${error.message}`)
    }

    // 7. Summary
    console.log('\n📊 SUMMARY:')
    console.log('============')
    console.log(`Total users: ${userCount}`)
    console.log(`Users with recent activity: ${usersWithActivity.length}`)
    console.log(`Users with enough activity (≥3): ${usersWithEnoughActivity}`)
    console.log(`Users without recent summary: ${usersWithoutRecentSummary}`)
    console.log(`Eligible users for summary: ${eligibleUsers}`)
    console.log(`Recent summaries generated: ${recentSummaries}`)

    if (eligibleUsers === 0) {
      console.log('\n❌ NO ELIGIBLE USERS FOUND')
      console.log('Reasons:')
      if (usersWithActivity.length === 0) {
        console.log('- No users have recent activity')
      }
      if (usersWithEnoughActivity === 0) {
        console.log('- No users have enough activity (need ≥3 activities)')
      }
      if (usersWithoutRecentSummary === 0) {
        console.log('- All users already have recent summaries')
      }
    } else {
      console.log(
        `\n✅ ${eligibleUsers} users are eligible for summary generation`
      )
    }
  } catch (error) {
    console.error('❌ Error during troubleshooting:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the troubleshooting
troubleshootDailySummary().catch(console.error)
