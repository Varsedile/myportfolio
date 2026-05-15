const track = document.querySelector('.track');
const slides = document.querySelectorAll('.project-img');
let current = 0;

document.getElementById('next-btn').addEventListener('click', () => {
  if (current < slides.length - 1) current++;
  track.style.transform = `translateX(-${current * 100}%)`;
});

document.getElementById('prev-btn').addEventListener('click', () => {
  if (current > 0) current--;
  track.style.transform = `translateX(-${current * 100}%)`;
});