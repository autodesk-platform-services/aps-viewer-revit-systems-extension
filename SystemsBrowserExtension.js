//
// Copyright (c) Autodesk, Inc. All rights reserved
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
//

const SYSTEM_TYPE_PROPERTY = "System Type";
const SYSTEM_NAME_PROPERTY = "System Name";
const SYSTEM_CLASSIFICATION_PROPERTY = "System Classification";
const SYSTEM_CIRCUIT_NUMBER_PROPERTY = "Circuit Number";
const CHILD_PROPERTY = "child";
const REVIT_FAMILY_NAME_PROPERTY = '_RFN';

class SystemsBrowserExtension extends Autodesk.Viewing.Extension {
  constructor(viewer, options) {
    super(viewer, options);
    this._onObjectTreeCreated = (ev) => this.onModelLoaded(ev.model);
    this._panel = null;
  }

  async onModelLoaded(model) {
    this.systems = await this.getSystemsData(model);
    this._panel = new SystemsBrowserPanel(this.systems, this.viewer, 'systems-browser-panel', 'Systems Browser');
  }

  onToolbarCreated(toolbar) {
    // this._panel = new SystemsBrowserPanel(this.viewer, 'systems-browser-panel', 'Systems Browser');
    this._button = this.createToolbarButton('systemsbrowser-button', 'https://img.icons8.com/ios/50/pipelines.png', 'Systems Browser');
    this._button.onClick = async () => {
      const { ACTIVE, INACTIVE } = Autodesk.Viewing.UI.Button.State;
      this._panel.setVisible(!this._panel.isVisible());
      this._button.setState(this._panel.isVisible() ? ACTIVE : INACTIVE);
    };
  }

  createToolbarButton(buttonId, buttonIconUrl, buttonTooltip) {
    let group = this.viewer.toolbar.getControl('systems-toolbar-group');
    if (!group) {
      group = new Autodesk.Viewing.UI.ControlGroup('systems-toolbar-group');
      this.viewer.toolbar.addControl(group);
    }
    const button = new Autodesk.Viewing.UI.Button(buttonId);
    button.setToolTip(buttonTooltip);
    group.addControl(button);
    const icon = button.container.querySelector('.adsk-button-icon');
    if (icon) {
      icon.style.backgroundImage = `url(${buttonIconUrl})`;
      icon.style.backgroundSize = `24px`;
      icon.style.backgroundRepeat = `no-repeat`;
      icon.style.backgroundPosition = `center`;
    }
    return button;
  }

  removeToolbarButton(button) {
    const group = this.viewer.toolbar.getControl('systems-toolbar-group');
    group.removeControl(button);
  }

  async load() {
    console.log('Systems Browser Extension has been loaded.');
    this.viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, this._onObjectTreeCreated);
    return true;
  }

  unload() {
    if (this._button) {
      this.removeToolbarButton(this._button);
      this._button = null;
    }
    return true;
  }

  findLeafNodes(model) {
    return new Promise(function (resolve, reject) {
      model.getObjectTree(function (tree) {
        let leaves = [];
        tree.enumNodeChildren(tree.getRootId(), function (dbid) {
          if (tree.getChildCount(dbid) === 0) {
            leaves.push(dbid);
          }
        }, true /* recursively enumerate children's children as well */);
        resolve(leaves);
      }, reject);
    });
  }

  async getSystems(model) {
    let mepSystemCateNames = [
      'Duct Systems', 'Piping Systems', 'Electrical Circuits'
    ];

    const searchAsync = (text, attributeNames, options) => {
      return new Promise((resolve, reject) => {
        model.search(
          text,
          resolve,
          reject,
          attributeNames,
          options
        );
      });
    }

    let systemProps = [];
    for (let i = 0; i < mepSystemCateNames.length; i++) {
      let cateName = mepSystemCateNames[i];
      let dbIds = await searchAsync(cateName, ['_RC'], { searchHidden: true });
      let results = await this.getBulkPropertiesAsync(model, dbIds, { propFilter: ['_RFN', 'child', 'Category', 'name'], ignoreHidden: false })

      results = results.filter(e => e.properties.length > 0 && e.properties.find(prop => prop.attributeName == 'Category' && prop.displayValue == 'Revit Family Type') != null);
      systemProps.push(...results);
    }

    let elecDbIds = await searchAsync(mepSystemCateNames[mepSystemCateNames.length - 1], ['_RC'], { searchHidden: true });
    let elecResults = await this.getBulkPropertiesAsync(model, elecDbIds, { propFilter: ['child', 'Category', 'name'], ignoreHidden: false })

    elecResults = elecResults.filter(e => e.properties.length > 0 && e.properties.find(prop => prop.attributeName == 'Category' && prop.displayValue != 'Revit') != null);
    systemProps.push(...elecResults);

    return systemProps;
  }

  getSystemClassification(name) {
    let classification = '';
    switch (name) {
      case 'Duct System':
        classification = 'Mechanical';
        break;
      case 'Piping System':
        classification = 'Piping';
        break;
      default:
        classification = 'Electrical';
        break;
    }

    return classification;
  }

  getBulkPropertiesAsync(model, dbIds, options) {
    return new Promise((resolve, reject) => {
      model.getBulkProperties2(dbIds, options, resolve, resolve);
    });
  }

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
}

Autodesk.Viewing.theExtensionManager.registerExtension('SystemsBrowserExtension', SystemsBrowserExtension);

class SystemBrowserDelegate extends Autodesk.Viewing.UI.TreeDelegate {
  constructor(viewer, options) {
    super(viewer, options);
    this.viewer = viewer;
  }
  isTreeNodeGroup(node) {
    return node.entries && node.entries.length > 0;
  }

  getTreeNodeId(node) {
    return node.path;
  }

  getTreeNodeLabel(node) {
    return node.name;
  }

  getTreeNodeClass(node) {
    node.children && node.children.length > 0 ? 'group' : 'leaf';
  }

  forEachChild(node, callback) {
    for (const child of node?.entries) {
      callback(child);
    }
  }

  onTreeNodeClick(tree, node, event) {
    console.log('click', tree, node, event);
    this.viewer.isolate(node.dbIds);
    this.viewer.fitToView();
  }

  onTreeNodeDoubleClick(tree, node, event) {
    console.log('double-click', tree, node, event);
  }

  onTreeNodeRightClick(tree, node, event) {
    console.log('right-click', tree, node, event);
  }

  createTreeNode(node, parent, options, type, depth) {
    const label = super.createTreeNode(node, parent, options, type, depth);
    const icon = label.previousSibling;
    const row = label.parentNode;
    // Center arrow icon
    if (icon) {
      icon.style.backgroundPositionX = '5px';
      icon.style.backgroundPositionY = '5px';
    }
    // Offset rows depending on their tree depth
    row.style.padding = `5px`;
    row.style.paddingLeft = `${5 + (type === 'leaf' ? 20 : 0) + depth * 20}px`;
    return label;
  }
}

class SystemsBrowserPanel extends Autodesk.Viewing.UI.DockingPanel {
  constructor(systemData, viewer, id, title) {
    super(viewer.container, id, title);
    this.container.classList.add('property-panel'); // Re-use some handy defaults
    this.container.dockRight = true;
    this.createScrollContainer({ left: false, heightAdjustment: 70, marginTop: 0 });
    this.delegate = new SystemBrowserDelegate(viewer);
    this.tree = new Autodesk.Viewing.UI.Tree(this.delegate, systemData, this.scrollContainer);
  }
}