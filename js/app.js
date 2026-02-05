
import { FurnitureDB } from './db.js';

// DOM Elements
const productGrid = document.querySelector('.product-grid');
const fab = document.querySelector('.fab');
const modalOverlay = document.querySelector('.modal-overlay');
const productForm = document.getElementById('product-form');
const cancelBtn = document.getElementById('cancel-btn');
const imageInput = document.getElementById('image-input');
const imagePreview = document.getElementById('image-preview');
const formTitle = document.getElementById('form-title');
const searchInput = document.getElementById('search-input');
const categoryFilters = document.getElementById('category-filters');
const lightboxOverlay = document.getElementById('lightbox-overlay');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');

let currentEditId = null;
let activeCategory = 'All';
let searchTerm = '';
let currentImages = []; // Array of blobs
let currentLightboxImages = []; // Array of URLs
let currentLightboxIndex = 0;

// Initialize App
async function init() {
    // Register Service Worker for PWA/Android
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('./sw.js');
        } catch (err) {
            console.log('Service Worker registration failed:', err);
        }
    }

    try {
        await renderProducts();
    } catch (err) {
        console.error('Failed to initialize app:', err);
    }
}

// Render Products
async function renderProducts() {
    let products = await FurnitureDB.getAll();

    // Filter
    if (activeCategory !== 'All') {
        products = products.filter(p => (p.category || 'Other') === activeCategory);
    }
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        products = products.filter(p =>
            p.name.toLowerCase().includes(lower) ||
            (p.details && p.details.toLowerCase().includes(lower))
        );
    }

    const isGroupedView = activeCategory === 'All' && !searchTerm;
    const container = document.getElementById('main-content');
    container.innerHTML = '';

    if (products.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🪑</div>
                <h3>No Furniture Found</h3>
                <p>Try adjusting your search or filters.</p>
            </div>
        `;
        return;
    }

    if (isGroupedView) {
        // Group by category
        const groups = products.reduce((acc, p) => {
            const cat = p.category || 'Other';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(p);
            return acc;
        }, {});

        // Define order (optional, but nice)
        const order = ['Sofa', 'Bed', 'Table', 'Chair', 'Storage', 'Other'];
        // Add any found that aren't in order
        Object.keys(groups).forEach(k => {
            if (!order.includes(k)) order.push(k);
        });

        order.forEach(cat => {
            if (groups[cat] && groups[cat].length > 0) {
                // Render Header
                const header = document.createElement('h2');
                header.className = 'category-header';
                header.innerHTML = `${getCategoryIcon(cat)} ${cat}`;
                container.appendChild(header);

                // Render Grid
                const grid = document.createElement('div');
                grid.className = 'product-grid';
                grid.style.padding = '0'; // Reset padding as container handles it
                grid.style.paddingBottom = '2rem';

                groups[cat].forEach((product, index) => {
                    grid.appendChild(createProductCard(product, index));
                });
                container.appendChild(grid);
            }
        });
    } else {
        // Flat List
        const grid = document.createElement('div');
        grid.className = 'product-grid';
        products.forEach((product, index) => {
            grid.appendChild(createProductCard(product, index));
        });
        container.appendChild(grid);
    }
}

function getCategoryIcon(cat) {
    const icons = {
        'Sofa': '🛋️', 'Bed': '🛏️', 'Table': '桌', 'Chair': '🪑',
        'Storage': '📦', 'Other': '✨'
    };
    return icons[cat] || '✨';
}

function createProductCard(product, index) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.style.animationDelay = `${index * 0.1}s`; // Staggered animation

    // Normalize images
    const images = product.images || (product.image ? [product.image] : []);
    const coverImage = images.length > 0 ? images[0] : null;

    // Card click acts as Edit (unless clicking image or actions)
    card.onclick = (e) => {
        if (e.target.closest('.action-btn')) return;
        if (e.target.classList.contains('product-image')) return;
        openEditModal(product);
    };

    // Convert Blob to URL
    let imageUrl;
    try {
        if (coverImage && (coverImage instanceof Blob || coverImage instanceof File)) {
            imageUrl = URL.createObjectURL(coverImage);
        } else {
            throw new Error('Invalid image data');
        }
    } catch (e) {
        // Fallback placeholder
        imageUrl = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23f5f5f4" width="100" height="100"/><text fill="%23a8a29e" x="50" y="50" text-anchor="middle" font-family="serif" font-style="italic">No Image</text></svg>';
    }

    card.innerHTML = `
            <div class="card-actions">
                <button class="action-btn btn-edit" title="Edit">✎</button>
                <button class="action-btn btn-delete" title="Delete">🗑️</button>
            </div>
            <img src="${imageUrl}" alt="${product.name}" class="product-image">
            ${images.length > 1 ? `<div style="position:absolute; bottom:0.5rem; right:0.5rem; background:rgba(0,0,0,0.6); color:white; padding:0.2rem 0.5rem; border-radius:1rem; font-size:0.8rem;">+${images.length - 1}</div>` : ''}
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-price">₹${product.price}</div>
            </div>
        `;

    // Attach event listeners to buttons
    const deleteBtn = card.querySelector('.btn-delete');
    deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this item?')) {
            await FurnitureDB.delete(product.id);
            await renderProducts();
        }
    };

    const editBtn = card.querySelector('.btn-edit');
    editBtn.onclick = (e) => {
        e.stopPropagation();
        openEditModal(product);
    };

    // Lightbox for image
    const imgEl = card.querySelector('.product-image');
    imgEl.onclick = (e) => {
        e.stopPropagation();
        if (images.length > 0) {
            openLightbox(images, 0);
        }
    };

    return card;
}

// Lightbox Functions
function openLightbox(blobs, index) {
    currentLightboxImages = blobs
        .filter(b => b instanceof Blob || b instanceof File)
        .map(blob => URL.createObjectURL(blob));

    if (currentLightboxImages.length === 0) return;

    currentLightboxIndex = index;
    updateLightboxImage();
    lightboxOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function updateLightboxImage() {
    if (currentLightboxImages.length === 0) return;
    lightboxImage.src = currentLightboxImages[currentLightboxIndex];
    // Show/Hide arrows based on count
    lightboxPrev.style.display = currentLightboxImages.length > 1 ? 'block' : 'none';
    lightboxNext.style.display = currentLightboxImages.length > 1 ? 'block' : 'none';
}

function nextLightboxImage() {
    if (currentLightboxImages.length === 0) return;
    currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxImages.length;
    updateLightboxImage();
}

function prevLightboxImage() {
    if (currentLightboxImages.length === 0) return;
    currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxImages.length) % currentLightboxImages.length;
    updateLightboxImage();
}

function closeLightbox() {
    lightboxOverlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { lightboxImage.src = ''; }, 300);
}

// Lightbox Events
lightboxClose.addEventListener('click', closeLightbox);
lightboxPrev.addEventListener('click', (e) => { e.stopPropagation(); nextLightboxImage(); }); // Swap for logic if needed (Prev/Next is correct here)
lightboxNext.addEventListener('click', (e) => { e.stopPropagation(); nextLightboxImage(); });
lightboxPrev.onclick = (e) => { e.stopPropagation(); prevLightboxImage(); }; // Overwrite above line
lightboxNext.onclick = (e) => { e.stopPropagation(); nextLightboxImage(); };

lightboxOverlay.addEventListener('click', (e) => {
    if (e.target === lightboxOverlay) closeLightbox();
});

// Modal Handling
function openModal() {
    modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modalOverlay.classList.remove('open');
    document.body.style.overflow = '';
    resetForm();
}

function resetForm() {
    productForm.reset();
    currentImages = [];
    renderImagePreview();
    currentEditId = null;
    formTitle.textContent = 'Add Furniture';
}

function renderImagePreview() {
    imagePreview.innerHTML = '';
    if (currentImages.length === 0) {
        imagePreview.innerHTML = '<span>Tap to add photo</span>';
        return;
    }

    currentImages.forEach((blob, index) => {
        // Defensive check
        if (!(blob instanceof Blob) && !(blob instanceof File)) return;

        const img = document.createElement('img');
        img.src = URL.createObjectURL(blob);
        img.onclick = (e) => {
            e.stopPropagation();
            // Optional: Remove image on click
            if (confirm('Remove this photo?')) {
                currentImages.splice(index, 1);
                renderImagePreview();
            }
        };
        imagePreview.appendChild(img);
    });
}

function openEditModal(product) {
    currentEditId = product.id;
    formTitle.textContent = 'Edit Furniture';

    document.getElementById('name').value = product.name;
    document.getElementById('price').value = product.price;
    document.getElementById('category').value = product.category || 'Other';
    document.getElementById('details').value = product.details || '';

    // Convert legacy image to array if needed AND CLONE IT
    const existing = product.images || (product.image ? [product.image] : []);
    currentImages = [...existing]; // Safe clone
    renderImagePreview();

    openModal();
}

// Event Listeners
fab.addEventListener('click', () => {
    resetForm();
    openModal();
});

cancelBtn.addEventListener('click', closeModal);

// Close on outside click
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        closeModal();
    }
});

// Search & Filter Listeners
searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.trim();
    renderProducts();
});

categoryFilters.addEventListener('click', (e) => {
    if (e.target.classList.contains('chip')) {
        // Update UI
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');

        // Update State
        activeCategory = e.target.dataset.category;
        renderProducts();
    }
});

// Image Handling
imagePreview.addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        currentImages = [...currentImages, ...files];
        renderImagePreview();
        // Reset input so same file selection triggers change if needed
        imageInput.value = '';
    }
});

// Form Submission
productForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const price = document.getElementById('price').value;
    const itemsCategory = document.getElementById('category').value;
    const details = document.getElementById('details').value;

    const newItem = {
        name,
        price,
        category: itemsCategory,
        details,
        images: currentImages,
        updatedAt: new Date()
    };

    // If editing
    if (currentEditId) {
        newItem.id = currentEditId;
        await FurnitureDB.update(newItem);
    } else {
        await FurnitureDB.add(newItem);
    }

    closeModal();
    await renderProducts();
});


// Start
window.addEventListener('DOMContentLoaded', init);
