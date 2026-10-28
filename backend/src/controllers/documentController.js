import SharedDocument from '../models/SharedDocument.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import r2Service from '../services/r2Service.js';
import notificationService from '../services/notificationService.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Determine a high-level file category from original file name or mime type
 */
const resolveFileType = (originalName = '', mimeType = '') => {
  const ext = originalName.split('.').pop()?.toLowerCase() || '';
  const mime = (mimeType || '').toLowerCase();

  if (ext === 'pdf' || mime.includes('pdf')) return 'pdf';
  if (['doc', 'docx', 'rtf'].includes(ext) || mime.includes('word')) return 'doc';
  if (['xls', 'xlsx', 'csv'].includes(ext) || mime.includes('excel') || mime.includes('spreadsheet')) return 'sheet';
  if (['ppt', 'pptx'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint')) return 'slides';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'heic'].includes(ext) || mime.startsWith('image/')) return 'image';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) return 'archive';
  if (['txt', 'json', 'xml', 'md'].includes(ext) || mime.startsWith('text/')) return 'text';
  return 'file';
};

/**
 * @desc    Upload new shared documents with multiple files
 * @route   POST /api/documents
 * @access  Private (Admin & Employee)
 */
export const uploadDocuments = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (!title || !title.trim()) {
    throw ApiError.badRequest('Document title is required');
  }

  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest('Please select at least one file to upload');
  }

  const uploaderId = req.user._id;
  const uploaderName = req.user.employeeName || req.user.name || 'Team Member';
  const uploaderRole = req.user.role || 'employee';
  const uploaderEmployeeId = req.user.employeeId || '';

  // Upload each file buffer to Cloudflare R2
  const uploadedFiles = await Promise.all(
    req.files.map(async (file, index) => {
      const originalName = file.originalname || `document_${Date.now()}_${index}`;
      const mimeType = file.mimetype || 'application/octet-stream';
      const fileType = resolveFileType(originalName, mimeType);

      const r2Result = await r2Service.uploadBufferToR2(file.buffer, {
        folder: 'vairavan-automation/documents',
        originalName,
        mimeType,
      });

      return {
        originalName,
        fileName: originalName,
        url: r2Result.url,
        key: r2Result.key,
        mimeType,
        size: file.size || file.buffer?.length || 0,
        fileType,
      };
    })
  );

  // Create document metadata record in database
  const document = await SharedDocument.create({
    title: title.trim(),
    description: (description || '').trim(),
    uploader: uploaderId,
    uploaderName,
    uploaderRole,
    uploaderEmployeeId,
    files: uploadedFiles,
  });

  // Populate uploader details for immediate client-side rendering
  await document.populate('uploader', 'employeeName employeeId role email avatar');

  // Create in-app notification for all users (readBy includes uploader so uploader won't see badge for own upload)
  try {
    const notifMessage = `${uploaderName} uploaded "${document.title}" (${uploadedFiles.length} file${
      uploadedFiles.length > 1 ? 's' : ''
    })`;

    await Notification.create({
      recipientRole: 'all',
      sender: uploaderId,
      type: 'document_uploaded',
      title: 'New Shared Document',
      message: notifMessage,
      readBy: [uploaderId], // Uploader has already seen their own upload
      data: {
        documentId: document._id.toString(),
        title: document.title,
        uploaderName,
        uploaderRole,
        fileCount: uploadedFiles.length,
      },
    });

    // Send push notification to all other active users
    const otherUsers = await User.find({
      _id: { $ne: uploaderId },
      accountStatus: 'active',
    }).select('deviceTokens');

    const allTokens = otherUsers.flatMap((u) => u.deviceTokens || []);
    const uniqueTokens = [...new Set(allTokens)];

    if (uniqueTokens.length > 0) {
      notificationService
        .sendMulticastNotification(
          uniqueTokens,
          {
            title: 'New Shared Document 📁',
            body: notifMessage,
          },
          {
            type: 'document_uploaded',
            documentId: document._id.toString(),
            title: document.title,
            uploaderName,
          }
        )
        .catch((pushErr) => {
          console.warn('[Push] Error sending document upload push notification:', pushErr.message);
        });
    }
  } catch (notifErr) {
    console.warn('[Notification] Failed to create document upload notification:', notifErr.message);
  }

  return ApiResponse.created(res, 'Document uploaded successfully and shared with the team', {
    document,
  });
});

/**
 * @desc    Get shared documents with search, role filter, and pagination
 * @route   GET /api/documents
 * @access  Private (Admin & Employee)
 */
export const getDocuments = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
  const skip = (page - 1) * limit;

  const query = { isDeleted: false };

  // Search by title, description, or file name
  if (req.query.search && req.query.search.trim()) {
    const searchRegex = new RegExp(req.query.search.trim(), 'i');
    query.$or = [
      { title: searchRegex },
      { description: searchRegex },
      { 'files.originalName': searchRegex },
      { uploaderName: searchRegex },
    ];
  }

  // Filter by uploader role ('admin', 'employee')
  if (req.query.role && ['admin', 'employee'].includes(req.query.role)) {
    query.uploaderRole = req.query.role;
  }

  // Filter by specific uploader user ID
  if (req.query.uploader) {
    query.uploader = req.query.uploader;
  }

  const [documents, totalCount] = await Promise.all([
    SharedDocument.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('uploader', 'employeeName employeeId role email avatar'),
    SharedDocument.countDocuments(query),
  ]);

  // Check unread count for the current user
  const unreadCount = await Notification.countDocuments({
    type: 'document_uploaded',
    $or: [
      { recipient: req.user._id },
      { recipientRole: 'all' },
      { recipientRole: req.user.role },
    ],
    $and: [
      { isRead: false },
      { readBy: { $ne: req.user._id } },
    ],
  });

  return ApiResponse.success(res, 200, 'Shared documents retrieved successfully', {
    documents,
    unreadCount,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: page * limit < totalCount,
      hasPrevPage: page > 1,
    },
  });
});

/**
 * @desc    Delete a shared document (Admins can delete any, users can delete only their own)
 * @route   DELETE /api/documents/:id
 * @access  Private (Admin or Document Owner)
 */
export const deleteDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const document = await SharedDocument.findOne({ _id: id, isDeleted: false });
  if (!document) {
    throw ApiError.notFound('Shared document not found or already deleted');
  }

  const isOwner = document.uploader.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden('You do not have permission to delete this document. You can only delete documents you uploaded.');
  }

  // Soft delete the document record
  document.isDeleted = true;
  document.deletedAt = new Date();
  document.deletedBy = req.user._id;
  await document.save();

  // Asynchronously clean up files from Cloudflare R2
  if (Array.isArray(document.files)) {
    document.files.forEach((file) => {
      if (file.key) {
        r2Service.deleteFromR2(file.key).catch((err) => {
          console.warn(`[R2] Failed to delete file ${file.key}:`, err.message);
        });
      }
    });
  }

  return ApiResponse.success(res, 200, 'Document deleted successfully', {
    documentId: id,
  });
});

/**
 * @desc    Get unread document notification count for current user
 * @route   GET /api/documents/unread-count
 * @access  Private
 */
export const getUnreadDocumentCount = asyncHandler(async (req, res) => {
  const unreadCount = await Notification.countDocuments({
    type: 'document_uploaded',
    $or: [
      { recipient: req.user._id },
      { recipientRole: 'all' },
      { recipientRole: req.user.role },
    ],
    $and: [
      { isRead: false },
      { readBy: { $ne: req.user._id } },
    ],
  });

  return ApiResponse.success(res, 200, 'Unread document count retrieved', {
    unreadCount,
  });
});

/**
 * @desc    Mark all document upload notifications as viewed for current user
 * @route   PATCH /api/documents/mark-viewed
 * @access  Private
 */
export const markDocumentsViewed = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    {
      type: 'document_uploaded',
      readBy: { $ne: req.user._id },
    },
    {
      $addToSet: { readBy: req.user._id },
    }
  );

  return ApiResponse.success(res, 200, 'Document notifications marked as viewed');
});

export default {
  uploadDocuments,
  getDocuments,
  deleteDocument,
  getUnreadDocumentCount,
  markDocumentsViewed,
};
