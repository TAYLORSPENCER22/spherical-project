import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'; //css for mapbox draw
import 'mapbox-gl/dist/mapbox-gl.css';
import '../App.css'; //css for page 


mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;


const Mapbox: React.FC = () => {
    const mapContainer = useRef<HTMLDivElement | null>(null); //reference to mapcontainer div (initialized to null -- currently null)
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const popup = useRef<mapboxgl.Popup | null>(null);
    const drawRef = useRef<MapboxDraw | null>(null);
    const mapPinsRef = useRef<any>({});
    const editingPinRef = useRef(null);

    
    const [mapFormVisible, setMapFormVisible] = useState(false);
    const [formText, setFormText] = useState('');
    type  FormMode = 'create' | 'edit'; //types are immutable 
    const [formMode, setFormMode] = useState<FormMode>('create');


    useEffect (() => {

        if (!mapContainer.current) return;
       
        //create a new map 
    const map = new mapboxgl.Map({
        container: mapContainer.current, //render this map inside the mapContainer - container means where do we want to put the map, currenet means this element  
        style: 'mapbox://styles/mapbox/streets-v12', //simple mapbox style 
        center: [-118.371751, 34.0907], //lng lat
        zoom: 12,
        attributionControl: false 
        });

        mapRef.current = map;
        
        //add points and lines with mapbox draw
        const draw = new MapboxDraw({
            displayControlsDefault: false,
            controls: {
              point: true,
              trash: true
            }, 
            styles: [
              {
                id: 'highlight-active-points',
                type: 'circle',
                filter: ['all',
                  ['==', '$type', 'Point'],
                  ['==', 'meta', 'feature'],
                  ['==', 'active', 'true']
                ],
                paint: {
                  // slightly larger, rosy-pink active pin
                  'circle-radius': 12,
                  'circle-color': '#ff9abc',          // soft rose
                  'circle-stroke-color': '#ffffff',   // white outline
                  'circle-stroke-width': 2,
                  'circle-opacity': 0.9
                }
              },
              {
                id: 'points-are-blue',
                type: 'circle',
                filter: ['all',
                  ['==', '$type', 'Point'],
                  ['==', 'meta', 'feature'],
                  ['==', 'active', 'false']
                ],
                paint: {
                  // smaller, lavender-blue inactive pin
                  'circle-radius': 8,
                  'circle-color': '#b8c0ff',          // pastel lavender-blue
                  'circle-stroke-color': '#ffffff',   // white outline
                  'circle-stroke-width': 1.5,
                  'circle-opacity': 0.8
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


        //checks to see if we already have pins in local storage 
        //if we do, it displays them on the map 
        map.on('load', () => {

          try {
            const savedPins = localStorage.getItem('mapPins');
            if (savedPins) {
                mapPinsRef.current = JSON.parse(savedPins);
                const pinIds = Object.keys(mapPinsRef.current);
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
                // console.log('newFeatures', newFeatures);
                // loads all features to map
                draw.add({type: "FeatureCollection", features: newFeatures});
            }
          } catch (err) {
            console.log('Failed to load pins from storage', err);
          }
          


            map.on('draw.delete', (e) => {

              try {
                  //parse current storage 
                  const pins = JSON.parse(localStorage.getItem('mapPins') || '{}');

                  //loop through and delete the deleted
                  for (let i = 0; i < e.features.length; i++) {
                      const feat = e.features[i];
                      delete pins[feat.id];
                    }
  
                  //stringify and return 
                  localStorage.setItem('mapPins', JSON.stringify(pins));  
              } catch (err) {
                console.error('Error updating storage after delete', err);
              }   
                //close pop up when you delete 
                if (popup.current) {
                    popup.current.remove();
                    popup.current = null;
                }
                setMapFormVisible(false);
           })


            map.on('draw.create', (e) => {
                const newPin = e.features?.[0]
                if (newPin) {
                    editingPinRef.current = newPin.id;
                    mapPinsRef.current = {...mapPinsRef.current, [newPin.id]: {description: '', geotag: newPin.geometry.coordinates}};
                    setFormMode('create');
                    setTimeout(() => setMapFormVisible(true), 0);
                }
                    
            }) 

            // If the draw button is clicked, remove formText from form
            const pointButton = document.querySelector('.mapbox-gl-draw_point');
            if (pointButton) {
              pointButton.addEventListener('click', () => {
                setFormText('');
              });
            }

            //update the pop up to match the new pin coords 
            map.on('draw.update', (e) => {
                const moved = e.features?.[0];
                if(!moved) return;

                const id = String(moved.id);
                const newCoords = moved.geometry.coordinates as [number, number];

                if (popup.current && editingPinRef.current === id) {
                    popup.current.setLngLat(newCoords);
                  }

                if (mapPinsRef.current[id]) {
                    mapPinsRef.current[id].geotag = newCoords;
            }
        });


            map.on('click', (e) => {
                // grab any click from these layers
                const features = map.queryRenderedFeatures(e.point, {
                  layers: [
                    "points-are-blue.hot",
                    "highlight-active-points.hot",
                    "points-are-blue.cold",
                    "highlight-active-points.cold"
                  ],
                   
                });
                if (features.length === 0) {
                    setMapFormVisible(false);
                    return;
                  }
                const feature = features[0];

                //if there is no point -- return 
                if(!feature) {
                    return; //check  
                } else {

                    editingPinRef.current = feature.properties.id;
                    setFormMode('edit');

                    //might have to check if currentEditingPin exists in mapPins

                    if (editingPinRef.current) {
                        //  create pop
                        popup.current = new mapboxgl.Popup({ offset: 25})
                            .setLngLat(mapPinsRef.current[editingPinRef.current].geotag)
                            .setHTML(`<div >${mapPinsRef.current[editingPinRef.current].description || "you need a description :)"}</div>`)
                            .addTo(mapRef.current);
                        setFormText(mapPinsRef.current[editingPinRef.current].description)
                        popup.current.on('close',() => {
                            setFormText('');
                            setMapFormVisible(false);
                        })
                    } 
                }
    
                setMapFormVisible(true);
        })
        })
        
      return () => map.remove();
   }, []);

 
        const handleSave = () => {
            if (!mapRef.current) return;
            
            mapPinsRef.current = {...mapPinsRef.current, [editingPinRef.current]: {...mapPinsRef.current[editingPinRef.current], description: formText}};
            localStorage.setItem('mapPins', JSON.stringify(mapPinsRef.current));
        
            if (popup.current) {
                popup.current.remove();
              }

            popup.current = new mapboxgl.Popup({ offset: 25 })
                .setLngLat(mapPinsRef.current[editingPinRef.current].geotag)
                .setHTML(`<div>${formText}</div>`)
                .addTo(mapRef.current);
            setMapFormVisible(false);
            setFormText('');
        };

        //on form change we will update the state of setFormText
        //we will then use that to create a new pop!

        const onFormChange = (e) => {
            localStorage.setItem(editingPinRef.current, e.target.value);
            setFormText(e.target.value)
            
        }
        // localStorage.clear();
      
  return (
    <> 
    <div className='container'>
        <div className='map' ref= {mapContainer}></div>
        <div>
            {mapFormVisible &&
        <form className='mapForm' >
            <div className="formHeader">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#347D7D" viewBox="0 0 256 256"><path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM51.31,160,136,75.31,152.69,92,68,176.68ZM48,179.31,76.69,208H48Zm48,25.38L79.31,188,164,103.31,180.69,120Zm96-96L147.31,64l24-24L216,84.68Z"></path></svg>
                {formMode === 'create'
                ? " Create pin"
                : " Edit pin"}
            </div>
            <textarea 
            className='txtBox'
            maxLength={107} 
            placeholder='tell me about this place .. '
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
