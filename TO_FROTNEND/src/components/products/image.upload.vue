<template>
  <div class="image-upload-container">
    <!-- Current Image Preview -->
    <div v-if="currentImageUrl && !previewUrl" class="current-image">
      <img :src="currentImageUrl" :alt="altText" class="image-preview" />
      <div class="image-actions">
        <button
          v-if="allowDelete"
          type="button"
          @click="handleDeleteCurrent"
          class="btn btn-danger btn-sm"
          :disabled="isDeleting"
        >
          {{ isDeleting ? 'Deleting...' : 'Delete Image' }}
        </button>
      </div>
    </div>

    <!-- New Image Preview -->
    <div v-if="previewUrl" class="preview-container">
      <img :src="previewUrl" :alt="altText" class="image-preview" />
      <button type="button" @click="clearPreview" class="btn btn-secondary btn-sm">
        Cancel
      </button>
    </div>

    <!-- Upload Input -->
    <div v-if="!previewUrl && !currentImageUrl" class="upload-area">
      <label :for="inputId" class="upload-label">
        <div class="upload-content">
          <svg class="upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <span class="upload-text">Click to upload image</span>
          <span class="upload-hint">{{ allowedTypesText }} (Max {{ maxSizeMB }}MB)</span>
        </div>
      </label>
      <input
        :id="inputId"
        ref="fileInput"
        type="file"
        :accept="acceptedTypes"
        @change="handleFileSelect"
        class="file-input"
      />
    </div>

    <!-- Or Replace Button -->
    <div v-if="currentImageUrl && !previewUrl" class="replace-section">
      <label :for="inputId" class="btn btn-primary">
        Replace Image
      </label>
      <input
        :id="inputId"
        ref="fileInput"
        type="file"
        :accept="acceptedTypes"
        @change="handleFileSelect"
        class="file-input"
      />
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Upload Progress -->
    <div v-if="uploadProgress > 0 && uploadProgress < 100" class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${uploadProgress}%` }"></div>
      </div>
      <span class="progress-text">{{ uploadProgress }}%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface Props {
  modelValue?: File | null;
  currentImageUrl?: string | null;
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  allowDelete?: boolean;
  altText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  currentImageUrl: null,
  maxSize: 5 * 1024 * 1024, // 5MB default
  allowedTypes: () => ['image/jpeg', 'image/png', 'image/webp'],
  allowDelete: true,
  altText: 'Product image',
});

const emit = defineEmits<{
  'update:modelValue': [file: File | null];
  'delete': [];
  'error': [message: string];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const previewUrl = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const uploadProgress = ref(0);
const isDeleting = ref(false);

const inputId = computed(() => `file-upload-${Math.random().toString(36).substring(7)}`);

const maxSizeMB = computed(() => Math.round(props.maxSize / 1024 / 1024));

const acceptedTypes = computed(() => props.allowedTypes.join(','));

const allowedTypesText = computed(() => {
  return props.allowedTypes
    .map((type) => type.split('/')[1].toUpperCase())
    .join(', ');
});

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  errorMessage.value = null;

  // Validate file type
  if (!props.allowedTypes.includes(file.type)) {
    errorMessage.value = `Invalid file type. Allowed: ${allowedTypesText.value}`;
    emit('error', errorMessage.value);
    return;
  }

  // Validate file size
  if (file.size > props.maxSize) {
    errorMessage.value = `File too large. Max size: ${maxSizeMB.value}MB`;
    emit('error', errorMessage.value);
    return;
  }

  // Create preview
  const reader = new FileReader();
  reader.onload = (e) => {
    previewUrl.value = e.target?.result as string;
  };
  reader.readAsDataURL(file);

  // Simulate upload progress (replace with real progress if using axios)
  uploadProgress.value = 0;
  const interval = setInterval(() => {
    uploadProgress.value += 10;
    if (uploadProgress.value >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        uploadProgress.value = 0;
      }, 500);
    }
  }, 100);

  emit('update:modelValue', file);
};

const clearPreview = () => {
  previewUrl.value = null;
  errorMessage.value = null;
  emit('update:modelValue', null);
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const handleDeleteCurrent = async () => {
  if (!confirm('Are you sure you want to delete this image?')) return;

  isDeleting.value = true;
  try {
    emit('delete');
    // Parent component should handle the actual deletion
  } finally {
    isDeleting.value = false;
  }
};

// Reset preview if modelValue is cleared externally
watch(
  () => props.modelValue,
  (newValue) => {
    if (!newValue && previewUrl.value) {
      clearPreview();
    }
  }
);
</script>

<style scoped>
.image-upload-container {
  width: 100%;
  max-width: 400px;
}

.current-image,
.preview-container {
  position: relative;
  margin-bottom: 1rem;
}

.image-preview {
  width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: 8px;
  border: 2px solid var(--border-color, #30363d);
  background: var(--surface-color, #161b22);
}

.image-actions {
  margin-top: 0.5rem;
  display: flex;
  gap: 0.5rem;
}

.upload-area {
  width: 100%;
}

.upload-label {
  display: block;
  width: 100%;
  padding: 2rem;
  border: 2px dashed var(--border-color, #30363d);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--surface-color, #161b22);
}

.upload-label:hover {
  border-color: var(--primary-color, #1a1cf5);
  background: var(--surface-hover, #1c2128);
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.upload-icon {
  width: 48px;
  height: 48px;
  color: var(--text-muted, #8b949e);
}

.upload-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary, #e6edf3);
}

.upload-hint {
  font-size: 12px;
  color: var(--text-muted, #8b949e);
}

.file-input {
  display: none;
}

.replace-section {
  margin-top: 0.5rem;
}

.error-message {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: 6px;
  color: #fca5a5;
  font-size: 14px;
}

.progress-container {
  margin-top: 0.5rem;
}

.progress-bar {
  height: 6px;
  background: var(--surface-color, #161b22);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color, #1a1cf5);
  transition: width 0.3s ease;
}

.progress-text {
  display: block;
  margin-top: 0.25rem;
  font-size: 12px;
  color: var(--text-muted, #8b949e);
  text-align: center;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary-color, #1a1cf5);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover, #1515c7);
}

.btn-secondary {
  background: var(--surface-color, #161b22);
  color: var(--text-primary, #e6edf3);
  border: 1px solid var(--border-color, #30363d);
}

.btn-secondary:hover {
  background: var(--surface-hover, #1c2128);
}

.btn-danger {
  background: rgba(220, 38, 38, 0.1);
  color: #fca5a5;
  border: 1px solid rgba(220, 38, 38, 0.3);
}

.btn-danger:hover {
  background: rgba(220, 38, 38, 0.2);
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 13px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>