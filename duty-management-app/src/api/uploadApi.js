import apiClient from './apiClient';

export const uploadApi = {
  /**
   * Upload customer signature image
   * @param {string} uri - Local file uri or base64 file
   */
  uploadSignature: async (signatureInput) => {
    // If input is an object with svgString or dataUri
    if (
      signatureInput &&
      typeof signatureInput === 'object' &&
      (signatureInput.svgString || signatureInput.dataUri)
    ) {
      const res = await apiClient.post('/uploads/signature', {
        svgString: signatureInput.svgString,
        dataUri: signatureInput.dataUri,
      });
      return res.data;
    }

    // If input is a string starting with data:image/svg, <svg, or data:image/
    if (
      typeof signatureInput === 'string' &&
      (signatureInput.startsWith('data:image/svg') ||
        signatureInput.startsWith('<svg') ||
        signatureInput.startsWith('data:image/'))
    ) {
      const res = await apiClient.post('/uploads/signature', {
        dataUri: signatureInput,
      });
      return res.data;
    }

    // Otherwise it's a local file uri
    const uri = String(signatureInput);
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'signature.png';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/png';

    formData.append('signature', {
      uri,
      name: filename,
      type,
    });

    const res = await apiClient.post('/uploads/signature', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  /**
   * Upload customer service proof photos
   * @param {Array<string>} uris - Array of local image file uris
   */
  uploadProofPhotos: async (uris) => {
    const formData = new FormData();

    uris.forEach((uri, index) => {
      const filename = uri.split('/').pop() || `proof_${index}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('photos', {
        uri,
        name: filename,
        type,
      });
    });

    const res = await apiClient.post('/uploads/proof-photos', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  /**
   * Upload user avatar profile picture
   * @param {string} uri - Local image file uri
   */
  uploadAvatar: async (uri) => {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'avatar.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('avatar', {
      uri,
      name: filename,
      type,
    });

    const res = await apiClient.post('/uploads/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  deleteAsset: async (publicId) => {
    const res = await apiClient.delete(`/uploads/${encodeURIComponent(publicId)}`);
    return res.data;
  },
};

export default uploadApi;
