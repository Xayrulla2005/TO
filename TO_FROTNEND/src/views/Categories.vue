<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Kategoriyalar</h1>
        <p class="text-sm text-gray-500 mt-1">{{ categories.length }} ta kategoriya</p>
      </div>
      <button @click="showModal = true" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
        Yangi kategoriya
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="category in categories" :key="category.id" class="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3">
            <div :style="{ backgroundColor: category.color }" class="w-12 h-12 rounded-lg"></div>
            <div>
              <h3 class="font-semibold text-gray-900">{{ category.name }}</h3>
              <p class="text-sm text-gray-500">{{ category.description || 'Tavsif yo\'q' }}</p>
            </div>
          </div>
          <button @click="editCategory(category)" class="text-indigo-600 text-sm">Tahrirlash</button>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg max-w-md w-full p-6">
        <h2 class="text-xl font-semibold mb-4">{{ editing ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya' }}</h2>
        <form @submit.prevent="saveCategory" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Nomi *</label>
            <input v-model="form.name" required class="w-full px-4 py-2 border rounded-lg" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Tavsif</label>
            <textarea v-model="form.description" class="w-full px-4 py-2 border rounded-lg" rows="3"></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Rang</label>
            <input v-model="form.color" type="color" class="w-full h-12 border rounded-lg" />
          </div>
          <div class="flex gap-3">
            <button type="submit" class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg">Saqlash</button>
            <button type="button" @click="closeModal" class="px-4 py-2 border rounded-lg">Bekor qilish</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { categoriesService } from '../services/category.service';

const categories = ref<any[]>([]);
const showModal = ref(false);
const editing = ref<any>(null);
const form = ref({ name: '', description: '', color: '#3b82f6' });

const loadCategories = async () => {
  const result = await categoriesService.list({ page: 1, limit: 100 });
  categories.value = result.data;
};

const editCategory = (category: any) => {
  editing.value = category;
  form.value = { ...category };
  showModal.value = true;
};

const saveCategory = async () => {
  try {
    if (editing.value) {
      await categoriesService.update(editing.value.id, form.value);
    } else {
      await categoriesService.create(form.value);
    }
    await loadCategories();
    closeModal();
  } catch (error) {
    alert('Xatolik yuz berdi');
  }
};

const closeModal = () => {
  showModal.value = false;
  editing.value = null;
  form.value = { name: '', description: '', color: '#3b82f6' };
};

onMounted(loadCategories);
</script>