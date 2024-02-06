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
  let systems = await getSystems(model);
  let SYSTEMS_DATA = {
    name: 'Systems',
    path: 'systems',
    dbIds: [],
    entries: []
  };

  const leafNodeDbIds = await this.findLeafNodes(model);
  let leafNodeResults = await this.getBulkPropertiesAsync(model, leafNodeDbIds, { propFilter: [SYSTEM_TYPE_PROPERTY, SYSTEM_NAME_PROPERTY, SYSTEM_CIRCUIT_NUMBER_PROPERTY, 'name', 'Category'] });
  leafNodeResults = leafNodeResults.filter(e => e.properties.length >= 2);

  for (const system of systems) {
    let systemName = system.name;
    let familyNameProp = system.properties.find(p => p.attributeName == REVIT_FAMILY_NAME_PROPERTY);
    let systemClassificationName = getSystemClassification(familyNameProp?.displayValue);

    let currentSystemClassification = SYSTEMS_DATA.entries.find(s => s.name == systemClassificationName);
    if (!currentSystemClassification) {
      SYSTEMS_DATA.entries.push({ name: systemClassificationName, path: `systems/${systemClassificationName}`, dbIds: [], entries: [] });
      currentSystemClassification = SYSTEMS_DATA.entries.find(s => s.name == systemClassificationName);
    }

    let currentSystem = null;
    if (systemClassificationName == 'Electrical') {
      currentSystem = currentSystemClassification;
    } else {
      currentSystem = currentSystemClassification.entries.find(s => s.name == systemName);
      if (!currentSystem) {
        currentSystemClassification.entries.push({ name: systemName, path: `systems/${systemClassificationName}/${systemName}`, dbIds: [], entries: [] });
        currentSystem = currentSystemClassification.entries.find(s => s.name == systemName);
      }
    }

    let systemTypeDbIds = system.properties.filter(p => p.attributeName == CHILD_PROPERTY).map(p => p.displayValue);
    let systemTypeResults = await this.getBulkPropertiesAsync(model, systemTypeDbIds, { propFilter: [SYSTEM_TYPE_PROPERTY, SYSTEM_NAME_PROPERTY, SYSTEM_CIRCUIT_NUMBER_PROPERTY, 'name'] });

    for (let systemTypeResult of systemTypeResults) {
      let systemTypeTypeProp = systemTypeResult.properties.find(p => p.attributeName == SYSTEM_TYPE_PROPERTY);
      let systemTypeNameProp = systemTypeResult.properties.find(p => p.attributeName == SYSTEM_NAME_PROPERTY);
      let circuitNumberProp = systemTypeResult.properties.find(p => p.attributeName == SYSTEM_CIRCUIT_NUMBER_PROPERTY);

      let systemTypeName = systemTypeNameProp?.displayValue;
      let systemTypeEntryPath = `systems/${systemClassificationName}/${systemName}/${systemTypeName}`;
      if (systemClassificationName == 'Electrical') {
        systemTypeName = systemTypeTypeProp?.displayValue;
        systemTypeEntryPath = `systems/${systemClassificationName}/${systemTypeName}`;
      }

      let currentSystemType = currentSystem.entries.find(st => st.name == systemTypeName);
      if (!currentSystemType) {
        currentSystem.entries.push({ name: systemTypeName, path: systemTypeEntryPath, dbIds: [], entries: [] });
        currentSystemType = currentSystem.entries.find(st => st.name == systemTypeName);
      }

      let endElementResults = null;
      let prevCurrentSystemType = null;
      if (systemClassificationName == 'Electrical') {
        let circuitNumberVal = circuitNumberProp?.displayValue;
        let currentCircuitNumber = currentSystemType.entries.find(st => st.name == circuitNumberVal);
        if (!currentCircuitNumber) {
          currentSystemType.entries.push({ name: circuitNumberVal, path: `${systemTypeEntryPath}/${circuitNumberVal}`, dbIds: [], entries: [] });
          currentCircuitNumber = currentSystemType.entries.find(st => st.name == circuitNumberVal);
        }

        prevCurrentSystemType = currentSystemType;
        currentSystemType = currentCircuitNumber;
        let endElementSearchTerm = SYSTEM_CIRCUIT_NUMBER_PROPERTY;
        endElementResults = leafNodeResults.filter(e =>
          (e.properties.find(prop => prop.attributeName == endElementSearchTerm && prop.displayValue == currentSystemType.name) != null)
        );
      } else {
        let endElementSearchTerm = SYSTEM_NAME_PROPERTY;
        endElementResults = leafNodeResults.filter(e =>
          (e.properties.find(prop => prop.attributeName == endElementSearchTerm && prop.displayValue.split(',').some(s => s == currentSystemType.name)) != null)
        );
      }

      for (let endElement of endElementResults) {
        let endElementName = endElement.name;
        let currentEndElement = currentSystemType.entries.find(st => st.name == endElementName);
        if (!currentEndElement) {
          currentSystemType.entries.push({ name: endElementName, path: `${currentSystemType}/${endElementName}`, dbIds: [endElement.dbId], entries: [] });
          currentEndElement = currentSystemType.entries.find(st => st.name == endElementName);
        }
        currentSystemType.dbIds.push(endElement.dbId);
        prevCurrentSystemType?.dbIds.push(endElement.dbId);
        currentSystem.dbIds.push(endElement.dbId);
        currentSystemClassification.dbIds.push(endElement.dbId);
      }

      // Remove unused system types for electrical system
      if (currentSystemType.entries.length <= 0 && prevCurrentSystemType != null) {
        let idx = prevCurrentSystemType.entries.indexOf(currentSystemType);
        if (idx != -1)
          prevCurrentSystemType.entries.splice(idx, 1);
      }
    }
  }

  return SYSTEMS_DATA;
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
Eason Kang [in/eason-kang-b4398492/](https://www.linkedin.com/in/eason-kang-b4398492), [Developer Advocate](http://aps.autodesk.com)