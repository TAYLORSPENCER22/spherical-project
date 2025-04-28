import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'; //css for mapbox draw
import 'mapbox-gl/dist/mapbox-gl.css';
import '../App.css'; //css for page 


mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;


//typescript creating a react functional component
const Mapbox: React.FC = () => {
    const mapContainer = useRef<HTMLDivElement | null>(null); //reference to mapcontainer div (initialized to null -- currently null)
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const popup = useRef<mapboxgl.Popup | null>(null);
    const drawRef = useRef<MapboxDraw | null>(null);
    const mapPinsRef = useRef<any>({});
    const editingPinRef = useRef(null);

    
    const [mapFormVisible, setMapFormVisible] = useState(false);
    const [formText, setFormText] = useState('');


    useEffect (() => {

    if (mapContainer.current) {//check to see if map exists 
       
        //syntax to create a new map 
    const map = new mapboxgl.Map({
        container: mapContainer.current, //render this map inside the mapContainer - container means where do we want to put the map, currenet means this element  
        style: 'mapbox://styles/mapbox/streets-v12', //simple mapbox style 
        center: [-118.371751, 34.0907], //lng lat
        zoom: 12,
        attributionControl: false 
        });

        mapRef.current = map;
        (window as any).map = mapRef.current; //get access to map anywhere
        
        //add points and lines with mapbox draw
        const draw = new MapboxDraw({
            displayControlsDefault: false,
            controls: {
              point: true,
              trash: true
            }, 
            styles: [
                {
                  'id': 'highlight-active-points',
                  'type': 'circle',
                  'filter': ['all',
                    ['==', '$type', 'Point'],
                    ['==', 'meta', 'feature'],
                    ['==', 'active', 'true']],
                  'paint': {
                    'circle-radius': 10,
                    'circle-color': '#000000'
                  }
                },
                {
                  'id': 'points-are-blue',
                  'type': 'circle',
                  'filter': ['all',
                    ['==', '$type', 'Point'],
                    ['==', 'meta', 'feature'],
                    ['==', 'active', 'false']],
                  'paint': {
                    'circle-radius': 8,
                    'circle-color': '#000088'
                  }
                }
              ]
        });
          drawRef.current = draw;

       //controls
        map.addControl(new mapboxgl.NavigationControl()); //navigation 
        map.addControl(draw); //add draw control
        map.addControl(new mapboxgl.AttributionControl({
            customAttribution: 'Taylor Spencer' }));


        //waits for the map to finish loading, all logic must be inside
        map.on('load', () => {
            const savedPins = localStorage.getItem('mapPins');
            console.log('savedPins', savedPins);
            if (savedPins) {
                mapPinsRef.current = JSON.parse(savedPins);
                const pinIds = Object.keys(mapPinsRef.current);
                console.log('pinIds', pinIds);
                // loading pins from localStorage to feature type that draw accepts
                const newFeatures = pinIds.map(id => ({
                    id,
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "Point",
                        coordinates: mapPinsRef.current[id].geotag,
                    }
                }))
                console.log('newFeatures', newFeatures);
                // loads all features to map
                draw.add({type: "FeatureCollection", features: newFeatures});
            }


            map.on('draw.delete', (e) => {

                //parse current storage 
                const pins = JSON.parse(localStorage.getItem('mapPins') || '{}');

                //loop through and delete the deleted
                for (let i = 0; i < e.features.length; i++) {
                    const feat = e.features[i];
                    delete pins[feat.id];
                  }

                //stringify and return 
                localStorage.setItem('mapPins', JSON.stringify(pins));
                console.log('remaining pins:', pins);
           })


            map.on('draw.create', (e) => {
                console.log("DRAW", e);
                const newPin = e.features?.[0]
                console.log('wtf?', newPin);
                if (newPin) {
                    editingPinRef.current = newPin.id;
                    mapPinsRef.current = {...mapPinsRef.current, [newPin.id]: {description: '', geotag: newPin.geometry.coordinates}};
                    setMapFormVisible(true);
                }
            }) 

            // If the draw button is clicked, remove formText from form
            const pointButton = document.querySelector('.mapbox-gl-draw_point');
            if (pointButton) {
              pointButton.addEventListener('click', () => {
                setFormText('');
              });
            }

            map.on('click', ["points-are-blue.hot",'highlight-active-points.hot',
                            'points-are-blue.cold', 'highlight-active-points.cold' ] , (e) => { //this is the layer where the point is 
                const feature = e.features?.[0]; //grabs the first element from the points array thats created on click (click event) and displays it 


                //if there is no point -- return 
                if(!feature) {
                    return; //check  
                } else {

                    console.log('feature', feature);

                    editingPinRef.current = feature.properties.id;

                    console.log('all local', localStorage)
                    console.log('editingPinRef', editingPinRef.current);
                    console.log('mapPins1', mapPinsRef.current);
                    //might have to check if currentEditingPin exists in mapPins

                    if (editingPinRef.current) {
                        //  create pop
                        console.log('MADE IT');
                        popup.current = new mapboxgl.Popup({ offset: 25})
                            .setLngLat(mapPinsRef.current[editingPinRef.current].geotag)
                            .setHTML(`<div >${mapPinsRef.current[editingPinRef.current].description || "Add description"}</div>`)
                            .addTo(mapRef.current);
                        setFormText(mapPinsRef.current[editingPinRef.current].description)
                        popup.current.on('close',() => {
                            setFormText('');
                        })
                    } 
                }
    
                setMapFormVisible(true);
        })
        })
        
      return () => map.remove();
   }}, []);

 
        const handleSave = () => {

            if (!mapRef.current) return;
           
            mapPinsRef.current = {...mapPinsRef.current, [editingPinRef.current]: {...mapPinsRef.current[editingPinRef.current], description: formText}};
            localStorage.setItem('mapPins', JSON.stringify(mapPinsRef.current));
        
            if (popup.current) {
                popup.current.setLngLat(mapPinsRef.current[editingPinRef.current].geotag)
                .setHTML(`<div >${formText}</div>`)
                .addTo(mapRef.current);
            }
            setMapFormVisible(false);
            setFormText('');
        };

        
    

        //on form change -- it will trigger the event
        //the event will take the text from the event and save it into set form text
        //this is where we take the current form text and add it to the pop up that was just clicked


        const onFormChange = (e) => {
            localStorage.setItem(editingPinRef.current, e.target.value);
            setFormText(e.target.value)
            // setMapPins({...mapPins, [currentEditingPin]: {...mapPins[currentEditingPin], description: e.target.value}})
        }
        // localStorage.clear();
        // console.log('length of items',localStorage.length);

  return (
    <> 
    <div className='container'>
        <div className='map' ref= {mapContainer}></div>
        <div>
            {mapFormVisible &&
        <form className='mapForm' >
            <textarea 
            className={`txtBox ${!mapFormVisible ? 'hide' : ''}`}
            maxLength={55} 
            placeholder='insert info here'
            value={formText}
            onChange={onFormChange}
            >

            </textarea>
                    <button
                    className='saveBtn'
                    type='button'
                    onClick={handleSave}>Save
        </button>
        </form>
 } </div>
    </div>
    </>
  )
}

export default Mapbox
