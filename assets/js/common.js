/* assets/js/common.js */
// This file contains common JavaScript functions used across the site.

// Toggle sidebar function (existing)
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.classList.toggle('open');
  }
}

// Toggle dropdown navigation menu
function toggleNavMenu() {
  const navMenu = document.querySelector('.nav-menu');
  if (navMenu) {
    navMenu.classList.toggle('active');
  }
}

// Close the navigation menu when clicking outside
document.addEventListener('click', function(event) {
  const navMenu = document.querySelector('.nav-menu');
  const menuButton = document.querySelector('.menu-button');
  
  if (navMenu && menuButton) {
    // If the click is outside both the nav menu and the menu button
    if (!navMenu.contains(event.target) && !menuButton.contains(event.target)) {
      navMenu.classList.remove('active');
    }
  }
});

// Initialize navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  const menuButton = document.querySelector('.menu-button');
  if (menuButton) {
    menuButton.addEventListener('click', function(event) {
      event.stopPropagation(); // Prevent the document click handler from firing
      toggleNavMenu();
    });
  }
});