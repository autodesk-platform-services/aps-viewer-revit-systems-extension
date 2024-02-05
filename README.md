# aps-viewer-revit-systems-extension

## Thumbnail

![thumbnail](./thumbnail.gif)

## Introduction

This sample shares an Extension that builds a tree view of the systems available in the rendered design.

It works based on the system-related properties from a model, and the idea is to build a docking panel on top of Viewer that hosts the nodes. We can have nodes referring from Systems to instances of elements, so when you click them, the correlated elements get highlighted in the scene.

## The approach

To achieve that we're going to leverage Petr's [Custom Tree Views](https://aps.autodesk.com/blog/custom-tree-views) blog and Viewer methods shared below.

### Preparing Systems Data

First thing we need to do is preparing the Sytems Data as soon as our design gets loaded. That's achieved with the snippet below.

```js
async getSystemsData(model) {
  //First we grab all the leaf nodes
  const dbids = await this.findLeafNodes(model);
  return new Promise(function (resolve, reject) {
    //Here we retrieve system-related properties for the leaf nodes
    model.getBulkProperties(dbids, {propFilter:[SYSTEM_TYPE_PROPERTY, SYSTEM_NAME_PROPERTY, SYSTEM_CLASSIFICATION_PROPERTY, 'name']}, function (results) {
      let systemsReady = false;
      //And then we filter to only use elements that are part of a system
      const systems_elements = results.filter(e => e.properties.length==3);
      for (const system_element of systems_elements) {
        //For each element we retrieve its properties
        let system_classification = system_element.properties.find(p => p.displayName==SYSTEM_CLASSIFICATION_PROPERTY);
        let system_type = system_element.properties.find(p => p.displayName==SYSTEM_TYPE_PROPERTY);
        let system_name = system_element.properties.find(p => p.displayName==SYSTEM_NAME_PROPERTY);
        let current_system = SYSTEMS_DATA.entries.find(s => s.name==system_type.displayCategory);
        //And then we start populating the SYSTEMS_DATA object
        if(!current_system){
          SYSTEMS_DATA.entries.push({name:system_type.displayCategory, path:`systems/${system_type.displayCategory}`, dbIds:[], entries:[]});
          current_system = SYSTEMS_DATA.entries.find(s => s.name==system_type.displayCategory);
        }
        current_system.dbIds.push(system_element.dbId);

        let current_system_type = current_system.entries.find(st => st.name==system_type.displayValue);
        if(!current_system_type){
          current_system.entries.push({name:system_type.displayValue, path:`systems/${system_type.displayCategory}/${system_type.displayValue}`, dbIds:[], entries:[]});
          current_system_type = current_system.entries.find(st => st.name==system_type.displayValue);
        }
        current_system_type.dbIds.push(system_element.dbId);

        let current_system_name = current_system_type.entries.find(sn => sn.name==system_name.displayValue);
        if(!current_system_name){
          current_system_type.entries.push({name:system_name.displayValue, path:`systems/${system_type.displayCategory}/${system_type.displayValue}/${system_name.displayValue}`, dbIds:[], entries:[]});
          current_system_name = current_system_type.entries.find(sn => sn.name==system_name.displayValue);
        }
        current_system_name.dbIds.push(system_element.dbId);

        current_system_name.entries.push({name:system_element.name, path:`systems/${system_type.displayCategory}/${system_type.displayValue}/${system_name.displayValue}/${system_element.name}`, dbIds:[system_element.dbId]})

      }
      resolve(systemsReady);
    }, reject);
  });
}
```

- In this case, each node contains an array of dbIds that we can use to isolate its elements

### Reacting to node click

We're also adding a reaction when a node gets clicked, so all the related dbIds get isolated.

[LIVE DEMO](https://autodesk-platform-services.github.io/aps-viewer-revit-systems-extension/)

## License

This sample is licensed under the terms of the [MIT License](http://opensource.org/licenses/MIT). Please see the [LICENSE](LICENSE) file for full details.

## Written by

Joao Martins [in/jpornelas](https://linkedin.com/in/jpornelas), [Developer Advocate](http://aps.autodesk.com)
