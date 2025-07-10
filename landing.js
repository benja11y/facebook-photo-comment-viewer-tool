document.getElementById('open-viewer-btn').addEventListener('click', function() {
  const json = document.getElementById('json-input').value.trim();
  if (!json) {
    alert('Please paste the JSON output from the bookmarklet.');
    return;
  }
  try {
    JSON.parse(json);
  } catch (e) {
    alert('Invalid JSON. Please check your input.');
    return;
  }
  localStorage.setItem('fb_photo_comment_json', json);
  window.open('index.html', '_blank');
});
