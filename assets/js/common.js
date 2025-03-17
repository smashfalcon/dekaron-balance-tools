/* assets/js/common.js */
// This file contains common JavaScript functions used across the site.

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.classList.toggle('open');
  }
}
