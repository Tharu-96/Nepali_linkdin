import os, json, urllib.request, urllib.parse
from dotenv import load_dotenv

load_dotenv('d:/Antigravity/Riya/Rozgar/backend/.env')
key = os.environ.get('GOOGLE_DISTANCE_MATRIX_API_KEY')
print('Distance key present:', bool(key))
orig = '27.7171,85.3240'
dest = '27.7172,85.3240'
url = 'https://maps.googleapis.com/maps/api/distancematrix/json?'+urllib.parse.urlencode({'origins':orig,'destinations':dest,'mode':'walking','key':key})
print('Calling:', url)
try:
    with urllib.request.urlopen(url, timeout=20) as r:
        data = json.load(r)
        print('status:', data.get('status'))
        print('error_message:', data.get('error_message'))
        print('rows:', json.dumps(data.get('rows'), indent=2))
except Exception as e:
    print('request failed', e)

# Geocoding
key2 = os.environ.get('GOOGLE_GEOCODING_API_KEY')
print('\nGeocode key present:', bool(key2))
addr = 'Kathmandu, Nepal'
url2 = 'https://maps.googleapis.com/maps/api/geocode/json?'+urllib.parse.urlencode({'address':addr,'key':key2})
print('Calling:', url2)
try:
    with urllib.request.urlopen(url2, timeout=20) as r:
        data2 = json.load(r)
        print('gstatus:', data2.get('status'))
        print('gerror:', data2.get('error_message'))
        print('results count', len(data2.get('results',[])))
        if data2.get('results'):
            print('first formatted_address:', data2['results'][0].get('formatted_address'))
except Exception as e:
    print('geocode request failed', e)
