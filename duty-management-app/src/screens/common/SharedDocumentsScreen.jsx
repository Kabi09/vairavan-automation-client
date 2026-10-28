import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import documentApi from '../../api/documentApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

const formatFileSize = (bytes = 0) => {
  if (!bytes || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i] || 'B'}`;
};

const formatUploadDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
};

const getFileIconConfig = (fileType = 'file', originalName = '') => {
  const ext = (originalName || '').split('.').pop()?.toLowerCase() || '';

  if (fileType === 'pdf' || ext === 'pdf') {
    return { name: 'document-text', color: '#DC2626', bg: '#FEE2E2', label: 'PDF' };
  }
  if (fileType === 'sheet' || ['xls', 'xlsx', 'csv'].includes(ext)) {
    return { name: 'grid', color: '#059669', bg: '#D1FAE5', label: 'EXCEL' };
  }
  if (fileType === 'doc' || ['doc', 'docx', 'rtf'].includes(ext)) {
    return { name: 'document', color: '#2563EB', bg: '#DBEAFE', label: 'WORD' };
  }
  if (fileType === 'slides' || ['ppt', 'pptx'].includes(ext)) {
    return { name: 'easel', color: '#EA580C', bg: '#FFEDD5', label: 'PPT' };
  }
  if (fileType === 'image' || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
    return { name: 'image', color: '#7C3AED', bg: '#EDE9FE', label: 'IMG' };
  }
  if (fileType === 'archive' || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { name: 'archive', color: '#D97706', bg: '#FEF3C7', label: 'ZIP' };
  }
  if (fileType === 'text' || ['txt', 'json', 'xml'].includes(ext)) {
    return { name: 'reader', color: '#475569', bg: '#F1F5F9', label: 'TXT' };
  }
  return { name: 'attach', color: '#0F172A', bg: '#F3F4F6', label: ext.toUpperCase() || 'FILE' };
};

export const SharedDocumentsScreen = ({ navigation }) => {
  const { user, isAdmin } = useAuth();
  const { refreshNotifications } = useNotifications();

  // Documents list state
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'admin' | 'employee'

  // Delete modal state
  const [deleteTargetDoc, setDeleteTargetDoc] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Download state
  const [downloadingKey, setDownloadingKey] = useState(null);

  // Upload modal state
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch shared documents
  const fetchDocuments = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const params = {};
        if (roleFilter !== 'all') {
          params.role = roleFilter;
        }
        if (searchQuery.trim()) {
          params.search = searchQuery.trim();
        }

        const res = await documentApi.getDocuments(params);
        if (res?.data?.documents) {
          setDocuments(res.data.documents);
        }

        // Mark document notifications as read on view
        documentApi.markDocumentsViewed().catch(() => {});
        if (typeof refreshNotifications === 'function') {
          refreshNotifications(true);
        }
      } catch (err) {
        console.error('Failed to fetch shared documents:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load documents');
      } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [roleFilter, searchQuery, refreshNotifications]
  );

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDocuments(true);
  }, [fetchDocuments]);

  // File Picker handler (Multi-file support)
  const handlePickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const assets = result.assets || [];
      if (assets.length === 0) return;

      // Filter out files larger than 25MB with alert
      const validFiles = [];
      const oversizedFiles = [];

      assets.forEach((f) => {
        if (f.size && f.size > 25 * 1024 * 1024) {
          oversizedFiles.push(f.name || 'File');
        } else {
          validFiles.push({
            uri: f.uri,
            name: f.name || `file_${Date.now()}`,
            mimeType: f.mimeType || 'application/octet-stream',
            size: f.size || 0,
          });
        }
      });

      if (oversizedFiles.length > 0) {
        Alert.alert(
          'File Size Limit (25MB)',
          `The following files exceed the 25MB limit and were skipped: ${oversizedFiles.join(', ')}`
        );
      }

      // Merge newly selected files up to 10 total files
      setSelectedFiles((prev) => {
        const combined = [...prev, ...validFiles];
        if (combined.length > 10) {
          Alert.alert('File Limit', 'You can upload a maximum of 10 files per document upload.');
          return combined.slice(0, 10);
        }
        return combined;
      });
    } catch (err) {
      console.error('Error picking document:', err);
      Alert.alert('File Selection Failed', err.message || 'Unable to open document picker');
    }
  };

  const handleRemoveSelectedFile = (indexToRemove) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Submit Upload Form
  const handleUploadSubmit = async () => {
    if (!uploadTitle.trim()) {
      Alert.alert('Title Required', 'Please enter a title for the shared document.');
      return;
    }
    if (selectedFiles.length === 0) {
      Alert.alert('Files Required', 'Please select at least one file to upload.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('title', uploadTitle.trim());
      formData.append('description', uploadDescription.trim());

      selectedFiles.forEach((file) => {
        formData.append('files', {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        });
      });

      const res = await documentApi.uploadDocuments(formData, (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      });

      if (res?.data?.document) {
        // Immediately prepend newly uploaded document to local state without requiring page reload
        setDocuments((prev) => [res.data.document, ...prev]);

        Alert.alert(
          'Document Uploaded! 🎉',
          `"${res.data.document.title}" with ${res.data.document.files?.length || 0} file(s) has been shared with all Admins and Employees.`
        );

        // Reset and close modal
        setUploadModalVisible(false);
        setUploadTitle('');
        setUploadDescription('');
        setSelectedFiles([]);
        setUploadProgress(0);

        // Trigger notifications refresh so everyone has updated states
        if (typeof refreshNotifications === 'function') {
          refreshNotifications(true);
        }
      }
    } catch (err) {
      console.error('Upload failed:', err);
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.message ||
        err.message ||
        'Upload failed. Please check network connection and try again.';
      Alert.alert('Upload Failed', errMsg);
    } finally {
      setUploading(false);
    }
  };

  // File Download & Preview handler
  const handleDownloadFile = async (file) => {
    if (!file?.url) {
      Alert.alert('Error', 'File download URL is not available.');
      return;
    }

    if (Platform.OS === 'web') {
      window.open(file.url, '_blank');
      return;
    }

    const fileIdentifier = file.key || file.url;
    setDownloadingKey(fileIdentifier);

    try {
      const safeName = (file.originalName || file.fileName || 'shared_document')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      const localUri = `${FileSystem.cacheDirectory}${Date.now()}_${safeName}`;

      const downloadResult = await FileSystem.downloadAsync(file.url, localUri);

      const isShareAvailable = await Sharing.isAvailableAsync();
      if (isShareAvailable) {
        await Sharing.shareAsync(downloadResult.uri, {
          dialogTitle: `Open ${file.originalName || 'Document'}`,
          mimeType: file.mimeType || 'application/octet-stream',
          UTI: 'public.item',
        });
      } else {
        await Linking.openURL(file.url);
      }
    } catch (err) {
      console.error('Download/Open error:', err);
      try {
        await Linking.openURL(file.url);
      } catch {
        Alert.alert('Unable to Open File', err.message || 'Could not download or open this file.');
      }
    } finally {
      setDownloadingKey(null);
    }
  };

  // Delete Document handler
  const handleConfirmDelete = async () => {
    if (!deleteTargetDoc?._id) return;

    setDeleting(true);
    try {
      await documentApi.deleteDocument(deleteTargetDoc._id);

      // Instantly update local state by removing deleted document
      setDocuments((prev) => prev.filter((d) => d._id !== deleteTargetDoc._id));

      Alert.alert('Deleted', 'Document has been removed from the shared workspace.');
      setDeleteTargetDoc(null);
    } catch (err) {
      console.error('Delete error:', err);
      Alert.alert(
        'Delete Failed',
        err.response?.data?.message || err.message || 'Could not delete document'
      );
    } finally {
      setDeleting(false);
    }
  };

  // Check if current user has permission to delete this document
  const canDeleteDoc = (doc) => {
    if (!doc) return false;
    if (isAdmin) return true;
    const uploaderId = typeof doc.uploader === 'object' ? doc.uploader?._id : doc.uploader;
    return String(uploaderId) === String(user?._id);
  };

  // Filtered documents count
  const filteredDocuments = useMemo(() => {
    return documents;
  }, [documents]);

  const renderDocumentItem = ({ item }) => {
    const isOwner =
      String(typeof item.uploader === 'object' ? item.uploader?._id : item.uploader) ===
      String(user?._id);
    const uploaderIsAdmin = item.uploaderRole === 'admin';
    const filesList = item.files || [];

    return (
      <Card style={styles.documentCard}>
        {/* Header: Title, Uploader Tag & Delete Action */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: SPACING.sm }}>
            <Text style={styles.documentTitle}>{item.title}</Text>
            <View style={styles.uploaderRow}>
              {/* Avatar Initial Pill */}
              <View
                style={[
                  styles.uploaderAvatar,
                  uploaderIsAdmin ? styles.adminAvatar : styles.employeeAvatar,
                ]}
              >
                <Text style={styles.uploaderAvatarText}>
                  {(item.uploaderName || 'U').substring(0, 1).toUpperCase()}
                </Text>
              </View>

              <View style={styles.uploaderTextWrap}>
                <View style={styles.uploaderBadgeRow}>
                  <Text style={styles.uploaderName} numberOfLines={1}>
                    {item.uploaderName}
                    {isOwner ? ' (You)' : ''}
                  </Text>
                  <View
                    style={[
                      styles.roleBadge,
                      uploaderIsAdmin ? styles.adminRoleBadge : styles.employeeRoleBadge,
                    ]}
                  >
                    <Ionicons
                      name={uploaderIsAdmin ? 'shield-checkmark' : 'person'}
                      size={10}
                      color={uploaderIsAdmin ? '#1E40AF' : '#059669'}
                    />
                    <Text
                      style={[
                        styles.roleBadgeText,
                        uploaderIsAdmin ? styles.adminRoleText : styles.employeeRoleText,
                      ]}
                    >
                      {uploaderIsAdmin ? 'Admin' : 'Staff'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.uploadTimeText}>{formatUploadDate(item.createdAt)}</Text>
              </View>
            </View>
          </View>

          {/* Delete Action (Admin or Document Owner) */}
          {canDeleteDoc(item) && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => setDeleteTargetDoc(item)}
              activeOpacity={0.7}
              accessibilityLabel="Delete document"
            >
              <Ionicons name="trash-outline" size={19} color={COLORS.danger} />
            </TouchableOpacity>
          )}
        </View>

        {/* Description (if present) */}
        {Boolean(item.description) && (
          <Text style={styles.documentDescription}>{item.description}</Text>
        )}

        {/* Files Section */}
        <View style={styles.filesSectionHeader}>
          <View style={styles.fileCountPill}>
            <Ionicons name="documents-outline" size={13} color={COLORS.primary} />
            <Text style={styles.fileCountText}>
              {filesList.length} {filesList.length === 1 ? 'Attached File' : 'Attached Files'}
            </Text>
          </View>
          <Text style={styles.fileSizeTotal}>
            Total: {formatFileSize(filesList.reduce((acc, f) => acc + (f.size || 0), 0))}
          </Text>
        </View>

        {/* Itemized File Cards */}
        <View style={styles.fileListContainer}>
          {filesList.map((file, fIdx) => {
            const isDownloading = downloadingKey === (file.key || file.url);
            const iconConfig = getFileIconConfig(file.fileType, file.originalName || file.fileName);

            return (
              <View key={file.key || file._id || fIdx} style={styles.fileCardRow}>
                {/* File Format Icon */}
                <View style={[styles.fileTypeBadge, { backgroundColor: iconConfig.bg }]}>
                  <Ionicons name={iconConfig.name} size={18} color={iconConfig.color} />
                  <Text style={[styles.fileTypeLabel, { color: iconConfig.color }]}>
                    {iconConfig.label}
                  </Text>
                </View>

                {/* File Details */}
                <View style={styles.fileDetails}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.originalName || file.fileName || 'Attached Document'}
                  </Text>
                  <Text style={styles.fileMeta}>{formatFileSize(file.size)}</Text>
                </View>

                {/* Download / Open Action Button */}
                <TouchableOpacity
                  style={styles.fileActionBtn}
                  onPress={() => handleDownloadFile(file)}
                  disabled={isDownloading}
                  activeOpacity={0.7}
                >
                  {isDownloading ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <>
                      <Ionicons name="arrow-down-circle" size={18} color={COLORS.primary} />
                      <Text style={styles.fileActionBtnText}>Open</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Screen Header */}
      <ScreenHeader
        title="Shared Documents"
        subtitle="Shared workspace for Admins & Employees"
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            style={styles.headerUploadBtn}
            onPress={() => setUploadModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="cloud-upload" size={17} color="#FFFFFF" />
            <Text style={styles.headerUploadBtnText}>Upload</Text>
          </TouchableOpacity>
        }
      />

      {/* Search Bar & Role Filters */}
      <View style={styles.filterSection}>
        {/* Search Input */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title, description, or file..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {Boolean(searchQuery.length > 0) && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Role Filter Chips */}
        <View style={styles.roleFilterRow}>
          <TouchableOpacity
            style={[styles.filterChip, roleFilter === 'all' && styles.filterChipActive]}
            onPress={() => setRoleFilter('all')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="albums-outline"
              size={13}
              color={roleFilter === 'all' ? '#FFFFFF' : COLORS.textSecondary}
            />
            <Text
              style={[styles.filterChipText, roleFilter === 'all' && styles.filterChipTextActive]}
            >
              All Files
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, roleFilter === 'admin' && styles.filterChipActive]}
            onPress={() => setRoleFilter('admin')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={13}
              color={roleFilter === 'admin' ? '#FFFFFF' : COLORS.textSecondary}
            />
            <Text
              style={[styles.filterChipText, roleFilter === 'admin' && styles.filterChipTextActive]}
            >
              From Admin
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, roleFilter === 'employee' && styles.filterChipActive]}
            onPress={() => setRoleFilter('employee')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="people-outline"
              size={13}
              color={roleFilter === 'employee' ? '#FFFFFF' : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.filterChipText,
                roleFilter === 'employee' && styles.filterChipTextActive,
              ]}
            >
              From Staff
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Documents List */}
      {loading && !refreshing ? (
        <LoadingIndicator message="Loading shared documents..." />
      ) : error ? (
        <View style={{ padding: SPACING.lg }}>
          <ErrorMessage message={error} onRetry={() => fetchDocuments()} />
        </View>
      ) : (
        <FlatList
          data={filteredDocuments}
          keyExtractor={(item) => item._id}
          renderItem={renderDocumentItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="document-attach-outline"
              title="No Shared Documents"
              description={
                searchQuery.trim() || roleFilter !== 'all'
                  ? 'No shared documents match your search or filter.'
                  : 'No documents have been uploaded yet. Tap "Upload Document" to share files with everyone.'
              }
              actionLabel="Upload First Document"
              onAction={() => setUploadModalVisible(true)}
            />
          }
        />
      )}

      {/* Floating Action Button (FAB) for fast access */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setUploadModalVisible(true)}
        activeOpacity={0.85}
        accessibilityLabel="Upload Document"
      >
        <Ionicons name="cloud-upload" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Upload Document Modal */}
      <Modal
        visible={uploadModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!uploading) setUploadModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleWrap}>
                <Ionicons name="cloud-upload-outline" size={22} color={COLORS.primary} />
                <Text style={styles.modalTitle}>Upload Shared Document</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (!uploading) setUploadModalVisible(false);
                }}
                disabled={uploading}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Notice Banner */}
              <View style={styles.sharedNoticeBanner}>
                <Ionicons name="information-circle" size={18} color="#2563EB" />
                <Text style={styles.sharedNoticeText}>
                  Every uploaded file is shared and accessible to all Admins & Employees.
                </Text>
              </View>

              {/* Title Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Document Title <Text style={{ color: COLORS.danger }}>*</Text>
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Service Manual, Blueprints, Safety Checklist..."
                  placeholderTextColor={COLORS.textMuted}
                  value={uploadTitle}
                  onChangeText={setUploadTitle}
                  maxLength={150}
                  editable={!uploading}
                />
                <Text style={styles.charCounter}>{uploadTitle.length}/150</Text>
              </View>

              {/* Description Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description (Optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Provide context, notes, or instructions for the team..."
                  placeholderTextColor={COLORS.textMuted}
                  value={uploadDescription}
                  onChangeText={setUploadDescription}
                  multiline
                  numberOfLines={3}
                  maxLength={1000}
                  editable={!uploading}
                />
              </View>

              {/* File Upload Section */}
              <View style={styles.inputGroup}>
                <View style={styles.fileLabelRow}>
                  <Text style={styles.inputLabel}>
                    Attached Files <Text style={{ color: COLORS.danger }}>*</Text>
                  </Text>
                  <Text style={styles.fileMaxLimit}>
                    {selectedFiles.length}/10 selected (Max 25MB/file)
                  </Text>
                </View>

                {/* Select Files Action Button */}
                <TouchableOpacity
                  style={[styles.pickFilesBtn, uploading && { opacity: 0.5 }]}
                  onPress={handlePickFiles}
                  disabled={uploading || selectedFiles.length >= 10}
                  activeOpacity={0.75}
                >
                  <Ionicons name="folder-open-outline" size={22} color={COLORS.primary} />
                  <View style={styles.pickFilesTextWrap}>
                    <Text style={styles.pickFilesTitle}>Choose Files to Upload</Text>
                    <Text style={styles.pickFilesSub}>
                      Select multiple: PDF, DOC, XLS, PPT, TXT, Images, ZIP
                    </Text>
                  </View>
                  <View style={styles.pickFilesAddBadge}>
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>

                {/* Selected Files Tray */}
                {selectedFiles.length > 0 && (
                  <View style={styles.selectedFilesTray}>
                    <Text style={styles.selectedFilesTrayHeader}>
                      Selected Files ({selectedFiles.length})
                    </Text>
                    {selectedFiles.map((file, idx) => {
                      const iconConfig = getFileIconConfig('file', file.name);
                      return (
                        <View key={`${file.uri}_${idx}`} style={styles.selectedFileItem}>
                          <View
                            style={[
                              styles.selectedFileTypeBadge,
                              { backgroundColor: iconConfig.bg },
                            ]}
                          >
                            <Ionicons name={iconConfig.name} size={15} color={iconConfig.color} />
                          </View>

                          <View style={styles.selectedFileInfo}>
                            <Text style={styles.selectedFileName} numberOfLines={1}>
                              {file.name}
                            </Text>
                            <Text style={styles.selectedFileSize}>
                              {formatFileSize(file.size)}
                            </Text>
                          </View>

                          {!uploading && (
                            <TouchableOpacity
                              style={styles.removeFileBtn}
                              onPress={() => handleRemoveSelectedFile(idx)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="close-circle" size={18} color={COLORS.danger} />
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Upload Progress Bar (when uploading) */}
              {uploading && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressTextRow}>
                    <Text style={styles.progressLabel}>Uploading and encrypting to storage...</Text>
                    <Text style={styles.progressPercent}>{uploadProgress}%</Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setUploadModalVisible(false)}
                disabled={uploading}
                style={styles.modalCancelBtn}
              />
              <PrimaryButton
                title={uploading ? 'Uploading...' : 'Upload & Share'}
                onPress={handleUploadSubmit}
                loading={uploading}
                disabled={uploading || !uploadTitle.trim() || selectedFiles.length === 0}
                style={styles.modalSubmitBtn}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        visible={Boolean(deleteTargetDoc)}
        title="Delete Shared Document?"
        message={`Are you sure you want to remove "${deleteTargetDoc?.title}"? All attached files will be deleted from the shared workspace.`}
        confirmText="Delete Document"
        confirmVariant="danger"
        loading={deleting}
        onCancel={() => {
          if (!deleting) setDeleteTargetDoc(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
  },
  headerUploadBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  filterSection: {
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 42,
    marginBottom: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.xs,
    fontSize: 14,
    color: COLORS.text,
  },
  clearSearchBtn: {
    padding: 2,
  },
  roleFilterRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: 90, // Leave room for FAB and safe margin
  },
  documentCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: 4,
  },
  uploaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  uploaderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.xs + 2,
  },
  adminAvatar: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  employeeAvatar: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  uploaderAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  uploaderTextWrap: {
    justifyContent: 'center',
  },
  uploaderBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  uploaderName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.sm,
  },
  adminRoleBadge: {
    backgroundColor: '#EFF6FF',
  },
  employeeRoleBadge: {
    backgroundColor: '#ECFDF5',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  adminRoleText: {
    color: '#1E40AF',
  },
  employeeRoleText: {
    color: '#059669',
  },
  uploadTimeText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  deleteBtn: {
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: '#FEF2F2',
  },
  documentDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  filesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginBottom: SPACING.xs,
  },
  fileCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fileCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  fileSizeTotal: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  fileListContainer: {
    gap: SPACING.xs,
  },
  fileCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: SPACING.xs + 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fileTypeBadge: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  fileTypeLabel: {
    fontSize: 8,
    fontWeight: '800',
    marginTop: 1,
  },
  fileDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  fileName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  fileMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  fileActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  fileActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.lg,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '90%',
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalCloseBtn: {
    padding: SPACING.xs,
  },
  modalBody: {
    padding: SPACING.lg,
  },
  sharedNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: SPACING.md,
  },
  sharedNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: 14,
    color: COLORS.text,
  },
  textArea: {
    height: 75,
    textAlignVertical: 'top',
  },
  charCounter: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },
  fileLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fileMaxLimit: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  pickFilesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderStyle: 'dashed',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.xs,
  },
  pickFilesTextWrap: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  pickFilesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  pickFilesSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  pickFilesAddBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedFilesTray: {
    marginTop: SPACING.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedFilesTrayHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  selectedFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.sm,
    padding: SPACING.xs + 2,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectedFileTypeBadge: {
    width: 26,
    height: 26,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.xs,
  },
  selectedFileInfo: {
    flex: 1,
  },
  selectedFileName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  selectedFileSize: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  removeFileBtn: {
    padding: 4,
  },
  progressContainer: {
    marginVertical: SPACING.sm,
    backgroundColor: '#EFF6FF',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#DBEAFE',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  modalActions: {
    flexDirection: 'row',
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.md,
  },
  modalCancelBtn: {
    flex: 1,
  },
  modalSubmitBtn: {
    flex: 2,
  },
});

export default SharedDocumentsScreen;
