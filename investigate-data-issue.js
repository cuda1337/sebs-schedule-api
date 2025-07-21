// Investigate the data inconsistency between daily schedule and database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigateDataIssue() {
  try {
    console.log('🔍 Investigating Monday AM assignment inconsistency...\n');
    
    // 1. Find JaLa
    const jala = await prisma.client.findFirst({
      where: { name: { contains: 'JaLa' } }
    });
    
    // 2. Find Madison Haas
    const madison = await prisma.staff.findFirst({
      where: { name: { contains: 'Madison Haas' } }
    });
    
    if (!jala || !madison) {
      console.log('❌ Could not find JaLa or Madison Haas');
      return;
    }
    
    console.log(`Found: JaLa (ID: ${jala.id}) and Madison Haas (ID: ${madison.id})\n`);
    
    // 3. Get ALL assignment versions to understand the history
    const versions = await prisma.assignmentVersion.findMany({
      orderBy: { versionNumber: 'desc' },
      take: 10
    });
    
    console.log('📋 Assignment Versions (most recent first):');
    versions.forEach(v => {
      console.log(`  Version ${v.id} - Number: ${v.versionNumber}, Created: ${v.createdAt.toLocaleDateString()}`);
    });
    
    // 4. Check what the daily schedule API would see (latest version)
    const latestVersion = versions[0];
    console.log(`\n✅ Latest version being used by daily schedule: ${latestVersion.id}\n`);
    
    // 5. Check JaLa's Monday assignments across ALL versions
    console.log('📊 JaLa Monday Assignments by Version:');
    const jalaMonday = await prisma.assignment.findMany({
      where: {
        clientId: jala.id,
        day: 'Monday'
      },
      include: {
        staff: true,
        version: true
      },
      orderBy: { versionId: 'desc' }
    });
    
    jalaMonday.forEach(a => {
      const isLatest = a.versionId === latestVersion.id;
      console.log(`  ${a.block} - Staff: ${a.staff?.name}, Version: ${a.versionId} (v${a.version?.versionNumber}) ${isLatest ? '← LATEST' : '← OLD'}`);
    });
    
    // 6. Check Madison's Monday assignments
    console.log('\n📊 Madison Haas Monday Assignments by Version:');
    const madisonMonday = await prisma.assignment.findMany({
      where: {
        staffId: madison.id,
        day: 'Monday'
      },
      include: {
        client: true,
        version: true
      },
      orderBy: { versionId: 'desc' }
    });
    
    madisonMonday.forEach(a => {
      const isLatest = a.versionId === latestVersion.id;
      console.log(`  ${a.block} - Client: ${a.client?.name}, Version: ${a.versionId} (v${a.version?.versionNumber}) ${isLatest ? '← LATEST' : '← OLD'}`);
    });
    
    // 7. Check what assignments exist in the LATEST version for Monday AM
    console.log('\n🎯 What the Daily Schedule Shows (Latest Version Only):');
    const latestJalaMonday = jalaMonday.filter(a => a.versionId === latestVersion.id);
    const latestMadisonMonday = madisonMonday.filter(a => a.versionId === latestVersion.id);
    
    console.log(`  JaLa Monday assignments in latest version: ${latestJalaMonday.length}`);
    latestJalaMonday.forEach(a => {
      console.log(`    - ${a.block}: ${a.staff?.name || 'No staff'}`);
    });
    
    console.log(`  Madison Monday assignments in latest version: ${latestMadisonMonday.length}`);
    latestMadisonMonday.forEach(a => {
      console.log(`    - ${a.block}: ${a.client?.name || 'No client'}`);
    });
    
    // 8. Explain the issue
    console.log('\n💡 Analysis:');
    const jalaHasOldAM = jalaMonday.some(a => a.block === 'AM' && a.versionId !== latestVersion.id);
    const jalaHasCurrentAM = jalaMonday.some(a => a.block === 'AM' && a.versionId === latestVersion.id);
    
    if (jalaHasOldAM && !jalaHasCurrentAM) {
      console.log('  ⚠️  JaLa has an AM assignment in an OLD version but NOT in the current version');
      console.log('  📋 Lunch schedule sees ALL versions (no filter)');
      console.log('  📅 Daily schedule sees ONLY the latest version');
      console.log('  ❗ This explains the discrepancy!');
    } else if (jalaHasCurrentAM) {
      console.log('  🔴 JaLa has AM assignment in CURRENT version - Daily schedule should show it!');
    } else {
      console.log('  ✅ JaLa has no AM assignments in any version');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateDataIssue();