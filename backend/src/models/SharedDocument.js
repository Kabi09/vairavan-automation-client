import mongoose from 'mongoose';

const sharedDocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
      maxlength: [150, 'Document title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    uploader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader user ID is required'],
      index: true,
    },
    uploaderName: {
      type: String,
      required: true,
      trim: true,
    },
    uploaderRole: {
      type: String,
      enum: ['admin', 'employee', 'staff'],
      required: true,
      index: true,
    },
    uploaderEmployeeId: {
      type: String,
      default: '',
      trim: true,
    },
    files: [
      {
        originalName: {
          type: String,
          required: true,
          trim: true,
        },
        fileName: {
          type: String,
          required: true,
          trim: true,
        },
        url: {
          type: String,
          required: true,
        },
        key: {
          type: String,
          required: true,
        },
        mimeType: {
          type: String,
          default: 'application/octet-stream',
        },
        size: {
          type: Number,
          default: 0,
        },
        fileType: {
          type: String,
          enum: ['pdf', 'doc', 'sheet', 'slides', 'image', 'archive', 'text', 'file'],
          default: 'file',
        },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

sharedDocumentSchema.index({ createdAt: -1 });
sharedDocumentSchema.index({ isDeleted: 1, createdAt: -1 });
sharedDocumentSchema.index({ uploaderRole: 1, createdAt: -1 });

const SharedDocument = mongoose.model('SharedDocument', sharedDocumentSchema);

export default SharedDocument;
