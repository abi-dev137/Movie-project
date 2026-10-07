/* the label used to save/load our movie list in localStorage */
const STORAGE_KEY = "watchlist-movies";

/* load saved movies on page start, or use an empty list if none exist yet */
let movies = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

/* holds the id of the movie currently being edited, or null when adding a new one */
let editingId = null;

/* a tiny built-in placeholder image, shown when a poster URL is missing or broken */
const FALLBACK_POSTER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="70" height="100">
      <rect width="70" height="100" fill="#0F1420"/>
      <text x="35" y="53" font-size="9" fill="#5C6479"
        text-anchor="middle" font-family="sans-serif">No image</text>
    </svg>
  `);

/* store references to page elements we'll need repeatedly, so we don't re-search the page each time */
const movieListEl  = document.getElementById("movieList");
const countLabelEl = document.getElementById("countLabel");
const searchInput  = document.getElementById("searchInput");
const sortSelect   = document.getElementById("sortSelect");

/* writes the current movie list to localStorage, call after every change */
function saveMovies() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(movies));
}

/* fills the form with an existing movie's details so you can change them */
function editMovie(id) {
  const movie = movies.find(m => m.id === id);
  if (!movie) return;

  document.getElementById("inputTitle").value = movie.title;
  document.getElementById("inputYear").value = movie.year;
  document.getElementById("inputGenre").value = movie.genre;
  document.getElementById("inputPoster").value = movie.poster;
  document.getElementById("inputDescription").value = movie.description || "";
  /* older movies have no country, so fall back to an empty box */
  document.getElementById("inputCountry").value = movie.country || "";

  /* remember which movie we're editing, so addMovie() knows to update instead of create */
  editingId = id;

  /* switch the button's label and reveal "Cancel edit" */
  document.getElementById("addBtn").textContent = "Save changes";
  document.getElementById("cancelEditBtn").style.display = "inline-block";

  /* scroll up to the form, in case the movie card is further down the page */
  document.getElementById("inputTitle").scrollIntoView({ behavior: "smooth", block: "center" });
  document.getElementById("inputTitle").focus();
}

function addMovie() {
  /* grab the input boxes */
  const titleEl  = document.getElementById("inputTitle");
  const yearEl   = document.getElementById("inputYear");
  const genreEl  = document.getElementById("inputGenre");
  const posterEl = document.getElementById("inputPoster");
  const descriptionEl = document.getElementById("inputDescription");
  const countryEl = document.getElementById("inputCountry");

  /* trim() removes accidental extra spaces before/after the text */
  const title = titleEl.value.trim();
  const year  = yearEl.value.trim();

  /* stop here if no title was typed */
  if (!title) {
    titleEl.focus();
    return;
  }

  /* only check for duplicates when ADDING — not when editing an existing one
     (otherwise editing a movie would falsely flag itself as a duplicate of itself) */
  if (!editingId) {
    const isDuplicate = movies.some(m =>
      m.title.toLowerCase() === title.toLowerCase() && m.year === year
    );
    if (isDuplicate) {
      alert("That movie is already on your list.");
      return;
    }
  }

  if (editingId) {
    /* EDIT MODE: find the existing movie and overwrite its fields in place */
    const movie = movies.find(m => m.id === editingId);
    movie.title = title;
    movie.year = year;
    movie.genre = genreEl.value.trim();
    movie.poster = posterEl.value.trim();
    movie.description = descriptionEl.value.trim();
    movie.country = countryEl.value.trim();
    /* watched state and addedAt are left untouched on purpose — editing shouldn't reset those */

    editingId = null;   /* leave edit mode */
    document.getElementById("addBtn").textContent = "Add to watchlist";
    document.getElementById("cancelEditBtn").style.display = "none";
  } else {
    /* ADD MODE: build a brand new movie object, same as before */
    const newMovie = {
      id: Date.now(),
      title: title,
      year: year,
      country: countryEl.value.trim(),
      genre: genreEl.value.trim(),
      poster: posterEl.value.trim(),
      description: descriptionEl.value.trim(),
      watched: false,
      addedAt: Date.now()
    };
    movies.push(newMovie);
  }

  saveMovies();
  render();

  /* clear the form either way */
  titleEl.value = "";
  yearEl.value = "";
  genreEl.value = "";
  posterEl.value = "";
  countryEl.value = "";
  descriptionEl.value = "";
  titleEl.focus();
}

function toggleWatched(id) {
  /* find() returns the first movie matching this id */
  const movie = movies.find(m => m.id === id);

  if (movie) {
    movie.watched = !movie.watched;   /* ! flips true to false, or false to true */
    saveMovies();
    render();
  }
}

function deleteMovie(id) {
  /* find the actual card element on the page for this movie */
  const cardEl = document.querySelector(`[data-id="${id}"]`);

  if (cardEl) {
    cardEl.classList.add("removing");   /* triggers the fade-out animation */
    setTimeout(() => {
      /* only remove it from the data AFTER the animation has had time to play */
      movies = movies.filter(m => m.id !== id);
      saveMovies();
      render();
    }, 250);   /* matches the 0.25s animation length above */
  }
}


function buildCard(movie) {
  const posterSrc = movie.poster || FALLBACK_POSTER;   /* use the fallback if no poster URL was given */
  const dateAdded = new Date(movie.addedAt).toLocaleDateString();
  const watchedClass = movie.watched ? "watched" : "";   /* adds the "watched" class only if true */

  return `
   <div class="card ${watchedClass}" data-id="${movie.id}">
      <img class="poster" src="${escapeHtml(posterSrc)}"
           alt="${escapeHtml(movie.title)} poster"
           onerror="this.onerror=null; this.src='${FALLBACK_POSTER}';">
      <div class="card-body">
        <div class="card-title-row">
          <span class="card-title">${escapeHtml(movie.title)}</span>${movie.year ? `<span class="card-divider">|</span><span class="card-year">${escapeHtml(movie.year)}</span>` : ""}
          ${movie.country ? `<span class="card-divider">|</span><span class="card-country">${escapeHtml(movie.country)}</span>` : ""}
        </div>
        ${movie.genre ? `<span class="badge">${escapeHtml(movie.genre)}</span>` : ""}
        ${movie.description ? `<span class="card-description">${escapeHtml(movie.description)}</span>` : ""}
        <span class="card-meta">Added ${dateAdded}</span>
        <div class="card-actions">
          <button class="toggle-btn" onclick="toggleWatched(${movie.id})">
            ${movie.watched ? "Watched" : "Mark watched"}
          </button>
          <button class="edit-btn" onclick="editMovie(${movie.id})">Edit</button>
          <button class="delete-btn" onclick="deleteMovie(${movie.id})">Delete</button>
        </div>
      </div>
    </div>
  `;
}

/* prevents pasted titles/URLs from accidentally breaking the page's HTML */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const sortMode = sortSelect.value;

  /* keep only movies matching the search text ("|| ''" stops older movies with no country showing up as "undefined") */
  let visible = movies.filter(m => {
    const haystack = `${m.title} ${m.year} ${m.country || ""} ${m.genre}`.toLowerCase();
    return haystack.includes(query);
  });

  /* sort the filtered list based on the dropdown */
  visible.sort((a, b) => {
    switch (sortMode) {
      case "earliest": return a.addedAt - b.addedAt;
      case "latest":   return b.addedAt - a.addedAt;
      case "az":       return a.title.localeCompare(b.title);
      case "year":     return (parseInt(a.year) || 0) - (parseInt(b.year) || 0);
      default:         return 0;
    }
  });

  /* show an empty-state message if there's nothing to display */
  if (visible.length === 0) {
    movieListEl.innerHTML = movies.length === 0
      ? `<div class="empty-state">Your watchlist is empty — add a movie above to get started.</div>`
      : `<div class="empty-state">No movies match your search.</div>`;
  } else {
    movieListEl.innerHTML = visible.map(buildCard).join("");
  }

  countLabelEl.textContent = `${movies.length} movie${movies.length === 1 ? "" : "s"}`;
}



/* run addMovie() when the button is clicked */
document.getElementById("addBtn").addEventListener("click", addMovie);

/* also let pressing Enter in any form input add the movie,
   except the country and genre boxes, where Enter is used to pick from their suggestion lists */
document.querySelectorAll(".panel input").forEach(el => {
  el.addEventListener("keydown", e => {
    if (e.key === "Enter" && el.id !== "inputCountry" && el.id !== "inputGenre") addMovie();
  });
});

/* cancel out of edit mode without saving changes */
document.getElementById("cancelEditBtn").addEventListener("click", () => {
  editingId = null;
  document.getElementById("addBtn").textContent = "Add to watchlist";
  document.getElementById("cancelEditBtn").style.display = "none";

  document.getElementById("inputTitle").value = "";
  document.getElementById("inputYear").value = "";
  document.getElementById("inputGenre").value = "";
  document.getElementById("inputCountry").value = "";
  document.getElementById("inputPoster").value = "";
  document.getElementById("inputDescription").value = "";
});

/* re-render instantly as you type in search, or change the sort dropdown */
searchInput.addEventListener("input", render);
sortSelect.addEventListener("change", render);

/* switch between list view and grid view using the dropdown */
const viewSelect = document.getElementById("viewSelect");

viewSelect.addEventListener("change", () => {
  if (viewSelect.value === "grid") {
    movieListEl.classList.add("grid-view");
  } else {
    movieListEl.classList.remove("grid-view");
  }
});

/* start with "earliest added" selected, matching the app's main purpose */
sortSelect.value = "earliest";

/* draw the initial screen (shows the empty-state message if no movies yet) */
render();