import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || 'mongodb+srv://Dude_Quizz:Zxcvbnm09%23@dudeai.2c3kmqr.mongodb.net/vairavan_auto?appName=DudeAI';

async function migrate() {
  await mongoose.connect(uri);
  for (const dbName of ['vairavan_auto23', 'vairavan_auto']) {
    const db = mongoose.connection.client.db(dbName);
    const duties = await db.collection('duties').find({}).sort({ createdAt: 1 }).toArray();
    console.log(`${dbName} total duties: ${duties.length}`);
    let seq = 1000;
    for (const d of duties) {
      const newId = `WORK-${seq}`;
      await db.collection('duties').updateOne({ _id: d._id }, { $set: { dutyId: newId } });
      console.log(`  Updated duty ${d._id} -> ${newId}`);
      seq++;
    }
    // Set counter to highest assigned sequence
    const finalSeq = seq > 1000 ? seq - 1 : 999;
    await db.collection('counters').updateOne(
      { _id: 'workId' },
      { $set: { seq: finalSeq } },
      { upsert: true }
    );
    console.log(`${dbName} counter 'workId' initialized to seq: ${finalSeq}`);
  }
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
