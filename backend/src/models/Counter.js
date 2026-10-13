import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    seq: {
      type: Number,
      default: 999,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Get next sequential ID for a given sequence key (e.g. 'workId' -> 'WORK-1000')
 */
counterSchema.statics.getNextSequence = async function (key, minStart = 1000) {
  // Try atomic increment
  let doc = await this.findById(key);
  if (!doc) {
    try {
      doc = await this.create({ _id: key, seq: minStart });
      return doc.seq;
    } catch (err) {
      // If concurrent insert occurred, proceed to findByIdAndUpdate
    }
  }

  const updated = await this.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  if (updated.seq < minStart) {
    updated.seq = minStart;
    await updated.save();
  }

  return updated.seq;
};

const Counter = mongoose.model('Counter', counterSchema);

export default Counter;
