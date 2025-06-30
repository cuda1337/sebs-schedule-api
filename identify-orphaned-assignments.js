// Script to identify and optionally clean up orphaned assignments
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function identifyOrphanedAssignments() {
  try {
    console.log('🔍 Identifying orphaned assignments...\n');
    
    // Get the active main version
    const mainVersion = await prisma.scheduleVersion.findFirst({
      where: { type: 'main', status: 'active' }
    });
    
    if (!mainVersion) {
      console.log('❌ No active main version found!');
      return;
    }
    
    console.log(`✅ Active main version: ${mainVersion.id}\n`);
    
    // Get all version IDs for reference
    const allVersions = await prisma.scheduleVersion.findMany({
      orderBy: { id: 'desc' }
    });
    
    console.log('📋 All versions in database:');
    allVersions.forEach(v => {
      const status = v.id === mainVersion.id ? ' ← ACTIVE' : '';
      console.log(`  - Version ${v.id}: Type: ${v.type}, Status: ${v.status}${status}`);
    });
    console.log('');
    
    // Find assignments NOT in the active version
    const orphanedAssignments = await prisma.assignment.findMany({
      where: {
        versionId: {
          not: mainVersion.id
        }
      },
      include: {
        client: true,
        staff: true,
        version: true
      }
    });
    
    console.log(`🔍 Found ${orphanedAssignments.length} assignments in non-active versions\n`);
    
    // Group by version for analysis
    const byVersion = {};
    orphanedAssignments.forEach(assignment => {
      const versionKey = `Version ${assignment.versionId}`;
      if (!byVersion[versionKey]) {
        byVersion[versionKey] = [];
      }
      byVersion[versionKey].push(assignment);
    });
    
    // Display orphaned assignments by version
    Object.entries(byVersion).forEach(([version, assignments]) => {
      console.log(`\n📂 ${version}: ${assignments.length} assignments`);
      
      // Group by day and block for better visibility
      const byDayBlock = {};
      assignments.forEach(a => {
        const key = `${a.day} ${a.block}`;
        if (!byDayBlock[key]) {
          byDayBlock[key] = [];
        }
        byDayBlock[key].push(a);
      });
      
      Object.entries(byDayBlock).forEach(([dayBlock, dayAssignments]) => {
        console.log(`  ${dayBlock}: ${dayAssignments.length} assignments`);
        // Show first few examples
        dayAssignments.slice(0, 3).forEach(a => {
          console.log(`    - ${a.client?.name || 'Unknown Client'} with ${a.staff?.name || 'Unknown Staff'}`);
        });
        if (dayAssignments.length > 3) {
          console.log(`    ... and ${dayAssignments.length - 3} more`);
        }
      });
    });
    
    // Specific check for JaLa
    console.log('\n🔍 Checking specifically for JaLa:');
    const jalaOrphaned = orphanedAssignments.filter(a => 
      a.client?.name?.includes('JaLa')
    );
    
    if (jalaOrphaned.length > 0) {
      console.log(`  ⚠️  Found ${jalaOrphaned.length} orphaned assignments for JaLa:`);
      jalaOrphaned.forEach(a => {
        console.log(`    - ${a.day} ${a.block} with ${a.staff?.name}, Version ${a.versionId}`);
      });
    } else {
      console.log('  ✅ No orphaned assignments found for JaLa');
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`  - Total assignments in database: ${await prisma.assignment.count()}`);
    console.log(`  - Assignments in active version: ${await prisma.assignment.count({ where: { versionId: mainVersion.id } })}`);
    console.log(`  - Orphaned assignments: ${orphanedAssignments.length}`);
    
    // Offer to clean up
    console.log('\n❓ To delete these orphaned assignments, run:');
    console.log('   node identify-orphaned-assignments.js --cleanup');
    console.log('\n⚠️  WARNING: This will permanently delete all assignments not in the active version!');
    
    // Check if cleanup flag was passed
    if (process.argv.includes('--cleanup')) {
      console.log('\n🗑️  Cleanup mode activated...');
      console.log('Are you sure you want to delete all orphaned assignments? Type "yes" to confirm:');
      
      // In a real scenario, you'd wait for user input here
      // For now, we'll just show what would be deleted
      console.log('\n[In production, this would wait for confirmation]');
      console.log('\nTo actually delete, uncomment the deletion code in the script.');
      
      // UNCOMMENT TO ACTUALLY DELETE:
      // const result = await prisma.assignment.deleteMany({
      //   where: {
      //     versionId: {
      //       not: mainVersion.id
      //     }
      //   }
      // });
      // console.log(`✅ Deleted ${result.count} orphaned assignments`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

identifyOrphanedAssignments();