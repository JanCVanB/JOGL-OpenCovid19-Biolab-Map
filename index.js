const LAB_QUESTION = 'Do you have access to a biolab or related space?';
const SHEET_ID = '1kcXcstyfrDD39NkF69gZ8oRnCC9U0LpU03jLGXl9_iM';
const SHEET_RANGE = 'Form Responses 1!A1:I';

const GOOGLE_API_KEY = 'AIzaSyDQ_c6thb-SgOIxY7TDPNOVARoUc8IGhh4';
const OPEN_CAGE_API_KEY = 'ae12ad0992e343dd96d87f23a86cf753';
const MAPBOX_TOKEN = 'pk.eyJ1IjoianlhbWFkIiwiYSI6ImNrN3lic2p6YTAzcnMzbXBkczExMmU3OTYifQ.h7zyFlpot_NhB4uyLIZ2zQ';

const TODO_MESSAGE = 'DONE!: Zooming, Combining overlapping circles';

function handle_google_api_client_load() {
  gapi.load('client', () => {
    gapi.client
      .init({
        apiKey: GOOGLE_API_KEY,
        discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
      })
      .then(main);
  });
}

function main() {
  const dmap = render_datamaps_map();
  load_survey_responses()
  // comment out to avoid expensive calls
  //       .then(survey_responses => compute_bubbles(survey_responses))
  //       .then(bubbles => render_bubbles(bubbles, dmap))
    .then(() => update_message(TODO_MESSAGE));

  const lmap = render_leaflet_map();

  d3.csv("./geocodes.csv")
    .then(data => {
      const markers = L.markerClusterGroup();

      const dots = data.map(d => L.circle([d.lat, d.lon]));
      markers
        .addLayers(dots)
        .addTo(lmap);
    });
}

function render_leaflet_map() {
  const map = L.map("leaflet-map").setView([0, 0], 0);

  L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    minZoom: 1,
    maxZoom: 18,
    id: 'mapbox/streets-v11',
    tileSize: 512,
    zoomOffset: -1,
    accessToken: MAPBOX_TOKEN
  }).addTo(map);

  return map;
}

function render_datamaps_map() {
  return new Datamap({
    element: document.getElementById('datamaps-map'),
    fills: {
      defaultFill: '#ABDDA4',
      city: 'blue'
    },
    geographyConfig: {
      popupOnHover: false,
      highlightOnHover: false
    },
    projection: 'equirectangular',
    responsive: true,
  });
}

function load_survey_responses() {
  return gapi.client.sheets.spreadsheets.values
    .get({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
    })
    .then(
      success_response => {
        const headers = success_response.result.values[0];
        const rows = success_response.result.values.slice(1);
        const survey_responses = rows
          .filter(row => row[1] !== '' && row[1] !== undefined)
          .map(row => {
            let survey_response = {};
            headers.forEach((header, index) => {
              survey_response[header] = row[index];
            });
            return survey_response;
          });
        return survey_responses;
      },
      error_response => {
        update_message(`Error: ${error_response.result.error.message}`);
      },
    );
}

function compute_bubbles(survey_responses) {
  const responses_with_labs = survey_responses.filter(
    response => response[LAB_QUESTION] !== 'No'
  );
  return Promise.all(
    responses_with_labs
      .map(survey_response => compute_bubble(survey_response))
  );
}

function compute_bubble(survey_response) {
  return fetch(`https://api.opencagedata.com/geocode/v1/json?key=${OPEN_CAGE_API_KEY}&q=${survey_response.City}`)
    .then(response => response.json())
    .then(geocode => {
      if (geocode.results.length === 0) {
        return {};
      }
      const city = geocode.results[0];
      return {
        city_from_geocode: city.formatted,
        city_from_survey: survey_response.City,
        email: survey_response.Email,
        fillKey: 'city',
        lab: survey_response[LAB_QUESTION],
        latitude: city.geometry.lat,
        longitude: city.geometry.lng,
        name: survey_response.name,
        radius: 10,
      };
    });
}

function render_bubbles(bubbles, map) {
  map.bubbles(
    bubbles,
    {
      popupTemplate: function(geo, datum) {
        return `
          <div class="hoverinfo">
            City: <b>"${datum.city_from_survey}"</b> (${datum.city_from_geocode})
            <br/>
            <br/>
            Name: <b>"${datum.name}"</b>
            <br/>
            Email: <b>"${datum.email}"</b>
            <br/>
            <br/>
            Do you have access to a biolab or related space? <b>"${datum.lab}"</b>
          </div>
        `;
      },
    },
  )
}

function update_message() {
  document.getElementById('message').innerText = 'TODO: Zooming, Combining overlapping circles';
}
