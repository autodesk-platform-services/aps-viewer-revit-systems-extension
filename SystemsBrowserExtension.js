var SYSTEMS_DATA = {
  name: 'Systems',
  path:'systems',
  dbIds:[],
  entries: []
};
const SYSTEM_TYPE_PROPERTY = "System Type";
const SYSTEM_NAME_PROPERTY = "System Name";
const SYSTEM_CLASSIFICATION_PROPERTY = "System Classification";

class SystemsBrowserExtension extends Autodesk.Viewing.Extension {
  constructor(viewer, options) {
    super(viewer, options);
    this._onObjectTreeCreated = (ev) => this.onModelLoaded(ev.model);
    this._panel = null;
  }

  async onModelLoaded(model) {
    this.systems = await this.getSystemsData(model);
    this._panel = new SystemsBrowserPanel(this.viewer, 'systems-browser-panel', 'Systems Browser');
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

  async getSystemsData(model) {
    const dbids = await this.findLeafNodes(model);
    return new Promise(function (resolve, reject) {
      model.getBulkProperties(dbids, {propFilter:[SYSTEM_TYPE_PROPERTY, SYSTEM_NAME_PROPERTY, SYSTEM_CLASSIFICATION_PROPERTY, 'name']}, function (results) {
        let systemsReady = false;
        const systems_elements = results.filter(e => e.properties.length==3);
        for (const system_element of systems_elements) {
          let system_classification = system_element.properties.find(p => p.displayName==SYSTEM_CLASSIFICATION_PROPERTY);
          let system_type = system_element.properties.find(p => p.displayName==SYSTEM_TYPE_PROPERTY);
          let system_name = system_element.properties.find(p => p.displayName==SYSTEM_NAME_PROPERTY);
          let current_system = SYSTEMS_DATA.entries.find(s => s.name==system_type.displayCategory);
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
}

Autodesk.Viewing.theExtensionManager.registerExtension('SystemsBrowserExtension', SystemsBrowserExtension);

class SystemBrowserDelegate extends Autodesk.Viewing.UI.TreeDelegate {
  constructor(viewer, options){
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
  constructor(viewer, id, title) {
      super(viewer.container, id, title);
      this.container.classList.add('property-panel'); // Re-use some handy defaults
      this.container.dockRight = true;
      this.createScrollContainer({ left: false, heightAdjustment: 70, marginTop: 0 });
      this.delegate = new SystemBrowserDelegate(viewer);
      this.tree = new Autodesk.Viewing.UI.Tree(this.delegate, SYSTEMS_DATA, this.scrollContainer);
  }
}