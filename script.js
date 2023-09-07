'use strict';

// popup for adding new workout configuration
const popupConfig = {
  maxWidth: 250,
  minWidth: 100,
  autoClose: false,
  closeOnClick: false,
};

// Workout is the parent class of both Cycling and Running class
// It is designed, so that the common properties and methods such as
// distance, duration, co-ordinates and more could follow DRY
class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  count() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // defined in min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevation) {
    super(coords, distance, duration);
    this.elevation = elevation;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // defined in km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// all the document elements required
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

// DESIGNING THE APP ARCHITECTURE WITH OOP
// App will be the main class of the entire project,
// it'll contain all the initiators, event listners, and app-data
class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];

  constructor() {
    console.log(`💎 To reset the localstorage, call "app.reset()"`);
    this._getPosition();

    // Get workouts from localStorage
    this._getLocalStorage();

    // Adding form event listner on-enter click for saving workout
    form.addEventListener('submit', this._newWorkout.bind(this));

    // adding event listner for input type change
    inputType.addEventListener('change', this._toggleElevationField);

    // adding event listner for containerWorkouts
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
  }

  _getPosition() {
    // getting user location through navigator
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert("Couldn't fetch your location!");
        }
      );
    }
  }

  _loadMap(position) {
    const { longitude: long, latitude: lat } = position.coords;

    // preparing map near the location
    this.#map = L.map('map').setView([lat, long], this.#mapZoomLevel);

    // setting tile theme through openstreetmap (I can use google map here too)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // setting the default map marker
    // L.marker([lat, long])
    //   .addTo(this.#map)
    //   .bindPopup('This is your current location!')
    //   .openPopup();

    // handling clicks on map to add new workout
    this.#map.on('click', this._showForm.bind(this));

    // render workouts from localstorage
    this.#workouts.forEach(workout => this._renderWorkoutMarker(workout));
  }

  _showForm(mapEventPosition) {
    this.#mapEvent = mapEventPosition;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputElevation.value =
      inputCadence.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');

    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    //  Handling the workout type change
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(event) {
    // helper functions for validating if inputs are number
    const validInputs = (...inputs) =>
      inputs.every(input => Number.isFinite(input));

    // helper functions for positive numbers
    const allPositive = (...inputs) => inputs.every(input => input > 0);

    // handle on add new workout submit click (there is no submit button but his is cool right
    // we're handling on enter click here)
    event.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout is running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // data validation
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive number');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout is cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // data validation
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive number');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout map as marker // adding marker to the map
    this._renderWorkoutMarker(workout);

    // Render workout on the list
    this._renderWorkout(workout);

    // Hide form + clear input fields // clearing all the input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords) // creates the marker
      .addTo(this.#map) // adds this to map
      .bindPopup(
        L.popup({
          ...popupConfig,
          className: `${workout.type}-popup`,
        })
      ) // create and binds popup to the market
      .setPopupContent(
        `${workout.type === 'running' ? '🏃' : '🚴'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    const { type, id, distance, duration, description } = workout;

    let html = `
      <li class="workout workout--${type}" data-id="${id}">
        <h2 class="workout__title">${description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${type === 'running' ? '🏃' : '🚴'}</span>
          <span class="workout__value">${distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${duration}</span>
          <span class="workout__unit">min</span>
        </div>`;

    if (type === 'running') {
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>`;
    }

    if (type === `cycling`) {
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🚵🏻‍♀️</span>
            <span class="workout__value">${workout.elevation}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>`;
    }

    // appending it to the DOM
    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(event) {
    const workoutElement = event.target.closest('.workout');

    if (!workoutElement) return;

    const workout = this.#workouts.find(
      work => work.id === workoutElement.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });

    // using the public interface
    // NOTE: working with OOP and localstorage has this issue;
    // When storing class Instances (objects) to the localstorage by making it a string (JSON.stringify) and converting back when we reload the page, we're basically losing the prototype chain of that object. So, at the time of reload, we'd have to create new instances and basically mimic the entire process of creating the instance as it would've been created as a fresh one. This functionality is not added in this project, this is just a note to understand this - that keeping workout.count() active would work just fine untill the page has been refreshed (As there no longer will be the prototype chain we'd have made traditionally)
    // workout.count();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const localWorkouts = JSON.parse(localStorage.getItem('workouts'));

    if (!localWorkouts) return;

    this.#workouts = localWorkouts;
    this.#workouts.forEach(workout => {
      this._renderWorkout(workout);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App
