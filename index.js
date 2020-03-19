const COLUMN_NAMES_DISPLAYED_IN_TABLE = ['name', 'Email', 'City'];
const GEOCODE_CITY_COLUMN_NAME = 'query';
const LAB_QUESTION = 'Do you have access to a biolab or related space?';
const LOADED_MESSAGE_HTML = '(All locations are approximate)'
const SHEET_ID = '1kcXcstyfrDD39NkF69gZ8oRnCC9U0LpU03jLGXl9_iM';
const SHEET_RANGE = 'Form Responses 1!A1:I';

const GOOGLE_API_KEY = 'AIzaSyDQ_c6thb-SgOIxY7TDPNOVARoUc8IGhh4';
const OPEN_CAGE_API_KEY = 'ae12ad0992e343dd96d87f23a86cf753';
const MAPBOX_TOKEN = 'pk.eyJ1IjoianlhbWFkIiwiYSI6ImNrN3lic2p6YTAzcnMzbXBkczExMmU3OTYifQ.h7zyFlpot_NhB4uyLIZ2zQ';

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
  const map = render_map();
  const table = render_table();
  Promise.all([
    load_geocodes(),
    load_survey_responses(),
  ]).then(data => {
    const [geocodes, survey_responses] = data;
    const geocoded_survey_responses = find_matching_geocodes(geocodes, survey_responses);
    const biolabs = filter_to_biolabs_with_geocode(geocoded_survey_responses);
    render_map_markers(biolabs, map);
    table.load_data(biolabs);
    update_message(LOADED_MESSAGE_HTML);
  });
}

function render_map() {
  const map = L.map('map').setView([0, 0], 0);
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

function render_map_markers(biolabs, map) {
  const markers = L.markerClusterGroup();
  const dots = biolabs.map(
    biolab => L.circle([biolab.geocode.lat, biolab.geocode.lon])
  );
  markers
    .addLayers(dots)
    .addTo(map);
}

function render_table() {
  return new Vue({
    el: '#table',
    vuetify: new Vuetify(),
    data () {
      return {
        expanded_rows: [],
        headers: [],
        query: '',
        rows: [],
      };
    },
    methods: {
      load_data(rows) {
        const sample_row = rows[0];
        const column_names = Object.keys(sample_row)
        const column_names_displayed = column_names.filter(
          column_name => COLUMN_NAMES_DISPLAYED_IN_TABLE.indexOf(column_name) > -1
        );
        this.headers = column_names_displayed.map(
          column_name => ({ text: column_name, value: column_name })
        );
        this.headers.push({ text: '', value: 'data-table-expand' });
        this.rows = rows.sort(
          (a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1
        );
      },
    },
  })
}

function load_geocodes() {
  return d3.csv("./geocodes.csv");
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

function filter_to_biolabs_with_geocode(survey_responses) {
  return survey_responses
    .filter(x => x[LAB_QUESTION] !== 'No')
    .filter(x => !!x.geocode);
}

function find_matching_geocodes(geocodes, survey_responses) {
  return survey_responses
    .map(survey_response => ({
      ...survey_response,
      geocode: geocodes.find(g => g[GEOCODE_CITY_COLUMN_NAME] === survey_response.City),
    }));
}

function update_message(message) {
  document.getElementById('message').innerHTML = message;
}
