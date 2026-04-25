const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('visible');
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

let currentSlide = 0;

function changeSlide(dir) {
  const track = document.getElementById('gallery-track');
  const slides = track.querySelectorAll('.gallery-slide');
  const total = slides.length;
  currentSlide = (currentSlide + dir + total) % total;
  track.style.transform = `translateX(-${currentSlide * 100}%)`;
  document.getElementById('current-slide').textContent = currentSlide + 1;
}
