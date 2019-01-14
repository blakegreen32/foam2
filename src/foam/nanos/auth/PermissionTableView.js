/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

 // TODO: update permission dependency graph
foam.CLASS({
  package: 'foam.nanos.auth',
  name: 'PermissionTableView',
  extends: 'foam.u2.Controller',

  imports: [
    'auth',
    'groupDAO',
    'permissionDAO',
    'user'
  ],

  requires: [
    'foam.nanos.auth.Group',
    'foam.nanos.auth.Permission',
    'foam.graphics.Label',
    'foam.graphics.ScrollCView'
  ],

  constants: {
    ROWS: 22
  },

  css: `
    ^ thead th {
      background: white;
      padding: 0;
      text-align: center;
    }

    ^ tbody td {
      text-align: center;
    }

    tbody {
       overflow: auto;
       width: 100%;
       height: 150px;
     }

    ^ tbody tr { background: white; }

    ^ .foam-u2-md-CheckBox {
      margin: 1px;
      border: none;
    }

    ^ .foam-u2-md-CheckBox:hover {
      background: #FFCCCC;
    }

    ^ tbody tr:hover {
      background: #eee;
    }

    ^ table {
       box-shadow: 0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23);
       width: auto;
       border: 0;
      }

    ^header {
      box-shadow: 0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23);
      background: white;
      padding: 8px;
      margin: 8px 0;
    }

    ^header input { float: right }

    ^ .permissionHeader {
      color: #444;
      text-align: left;
      padding-left: 6px;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'query',
      postSet: function() { this.skip = 0; },
      view: {
        class: 'foam.u2.TextField',
        type: 'Search',
        placeholder: 'Permission Search',
        onKey: true
      }
    },
    {
      name: 'selectedGroup',
      documentation: 'Array for managing checkbox value on groups filter'
    },
    {
      name: 'columns_',
      documentation: 'Array for managing checked groups'
    },
    {
      name: 'textData',
      documentation: 'input text value by user'

    },
    {
      class: 'Map',
      name: 'gpMap'
    },
    {
      class: 'Map',
      name: 'gMap'
    },
    {
      class: 'Map',
      name: 'pMap'
    },
    {
      class: 'Int',
      name: 'skip'
    },
    'ps',
    'gs',
    {
      name: 'filteredPs',
      expression: function(ps, query) {
        query = query.trim();
        return ps.filter(function(p) {
          return query == '' || p.id.indexOf(query) != -1;
        });
      }
    },
    {
      name: 'filteredRows',
      expression: function(filteredPs) {
        return filteredPs.length;
      }
    }
  ],

  methods: [
    function initMatrix() {
      var ps   = this.filteredPs, gs = this.gs;
      var self = this;
      this
        .addClass(this.myClass())
        .start()
          .style({display:'grid', justifyContent: 'center'})
          .start()
            .style({gridColumn: '1/span 1', gridRow: '1/span 1'})
            .addClass(this.myClass('header'))
            .add('Permission Matrix')
            .add(this.QUERY)
          .end()
          .start('table')
            .on('wheel', this.onWheel)
            .style({gridColumn: '1/span 1', gridRow: '2/span 1'})
            .start('thead')
              .start('tr')
                .start('th')
                  .attrs({colspan:1000})
                  .style({textAlign: 'left', padding: '8px', fontWeight: 400})
                  .add(gs.length, ' groups, ', ps.length, ' permissions', self.filteredRows$.map(function(rows) { return rows == ps.length ?  '' : (', ' + rows + ' selected'); }))
                  .start()
                    .style({float: 'right'})
                    .add('⋮')
                  .end()
                .end()
              .end()
              .start('tr')
                .start('th').style({minWidth: '510px'}).end()
                .call(function() { self.initTableColumns.call(this, gs); })
              .end()
            .end()
            .add(this.slot(function(skip, filteredPs) {
              var count = 0;
              return self.E('tbody').forEach(filteredPs, function(p) {
                if ( count > self.skip + self.ROWS ) return;
                if ( count < self.skip ) { count++; return; }
                count++;
                this.start('tr')
                  .start('td')
                    .addClass('permissionHeader')
                    .attrs({title: p.description})
                    .add(p.id)
                  .end()
                  .forEach(gs, function(g) {
                    this.start('td')
                      .attrs({title: g.id + ' : ' + p.id})
                      .tag(self.createCheckBox(p, g))
                    .end();
                  })
                .end();
              });
            }))
          .end()
          .start(self.ScrollCView.create({
            value$: self.skip$,
            extent: self.ROWS,
            height: self.ROWS*24.5,
            width: 26,
            size$: self.filteredRows$
          }))
            .style({gridColumn: '2/span 1', gridRow: '2/span 2', 'margin-top':'242px'})
          .end()
        .end();
    },

    // * -> null, foo.bar -> foo.*, foo.* -> *
    function getParentGroupPermission(p, g) {
      var pid = p.id;
      while ( true ) {
        while ( pid.endsWith('.*') ) {
          pid = pid.substring(0, pid.length-2);
        }
        if ( pid == '*' ) return null;
        var i = pid.lastIndexOf('.');
        pid = ( i == -1 ) ? '*' : pid.substring(0, i) + '.*';
        if ( pid in this.pMap ) return this.getGroupPermission(this.pMap[pid], g);
      }
    },

    function getGroupPermission(p, g) {
      var key  = p.id + ':' + g.id;
      var data = this.gpMap[key];

      if ( ! data ) {
        data = this.GroupPermission.create({
          checked: this.checkPermissionForGroup(p.id, g)
        });

        // data.impliedByParentPermission = ! data.checked && g.implies(p.id);

        // Parent Group Inheritance
        if ( g.parent ) {
          var a = this.gMap[g.parent];
          if ( a ) {
            var parent = g.parent && this.getGroupPermission(p, a);
            if ( parent ) {
              function update() {
                data.impliedByParentGroup = parent.granted;
              }
              update();
              parent.granted$.sub(update);
            }
          }
        }

        // Parent Permission Inheritance (wildcarding)
        var pParent = this.getParentGroupPermission(p, g);
        if ( pParent ) {
          function update2() {
            data.impliedByParentPermission = pParent.granted;
          }
          update2();
          pParent.granted$.sub(update2);
        }

        this.gpMap[key] = data;
      }

      return data;
    },

    function createCheckBox(p, g) {
      var self = this;
      return function() {
        var data = self.getGroupPermission(p, g);
        data.checked$.sub(function() {
          self.updateGroup(p, g, data.checked$, self);
        });

        return self.GroupPermissionView.create({data: data});
      };
    },

    function initTableColumns(gs) {
      var self = this;
      this.forEach(gs, function(g) {
        this.start('th')
          .attrs({title: g.description})
          .call(function() {
            var cv = foam.graphics.CView.create({width: 20, height: 200});
            var l  = foam.graphics.Label.create({
              text: g.id,
              x: 25,
              y: 8,
              color: 'black',
              font: '300 16px Roboto',
              width: 200,
              height: 20,
              rotation: -Math.PI/2});
            cv.add(l);
            this.add(cv);
          })
        .end();
      });
    },

    function initE() {
      this.SUPER();
      var self = this;

      this.groupDAO.orderBy(this.Group.ID).select().then(function(gs) {
        for ( var i = 0 ; i < gs.array.length ; i++ ) {
          self.gMap[gs.array[i].id] = gs.array[i];
        }
        self.permissionDAO.orderBy(self.Permission.ID).select().then(function(ps) {
          for ( var i = 0 ; i < ps.array.length ; i++ ) {
            self.pMap[ps.array[i].id] = ps.array[i];
          }
          self.gs = gs.array;
          self.ps = ps.array;
          self.initMatrix();
        })
      });
    },

    function checkPermissionForGroup(permissionId, group) {
      for ( i = 0 ; i < group.permissions.length ; i++ ) {
        if ( permissionId == group.permissions[i].id ) {
          return true;
        }
      }
    },

    function updateGroup(p_, g_, data, self) {
      var dao = this.groupDAO;
      var e   = foam.mlang.Expressions.create();

      dao.find(g_.id).then(function(group) {
        // Remove permission if found
        var permissions = group.permissions.filter(function(p) {
          return p.id != p_.id;
        });

        // parents' permissions
        group.parent$find.then(function(groupParent) {
          if ( groupParent != undefined ) {
              permissions += groupParent.permissions.filter(function(gp) {
                return gp.id == p_.id;
              });
          }
        });

        // Add if requested
        if ( data.get() ) permissions.push(p_);

        group.permissions = permissions;
        dao.put(group);
      });
    }
  ],

  listeners: [
    {
      name: 'onWheel',
      code: function(e) {
        var negative = e.deltaY < 0;
        // Convert to rows, rounding up. (Therefore minumum 1.)
        var rows = Math.ceil(Math.abs(e.deltaY) / 40);
        this.skip = Math.max(0, this.skip + (negative ? -rows : rows));
        if ( e.deltaY !== 0 ) e.preventDefault();
      }
    }
  ],

  classes: [
    {
      name: 'GroupPermission',
      properties: [
        {
          class: 'Boolean',
          name: 'checked'
        },
        {
          class: 'Boolean',
          name: 'impliedByParentPermission'
        },
        {
          class: 'Boolean',
          name: 'impliedByParentGroup'
        },
        {
          class: 'Boolean',
          name: 'implied',
          expression: function(impliedByParentPermission, impliedByParentGroup) {
            return impliedByParentPermission || impliedByParentGroup;
          }
        },
        {
          class: 'Boolean',
          name: 'granted',
          expression: function(checked, implied) {
            return checked || implied;
          }
        }
      ]
    },
    {
      name: 'GroupPermissionView',
      extends: 'foam.u2.View',
      css: `
        ^:hover { background: #f55 }
        ^checked { color: #4885ff }
        ^implied { color: gray }
      `,
      methods: [
        function initE() {
          this.SUPER();
          this.
            addClass(this.myClass()).
            style({width: '18px', height: '18px'}).
            enableClass(this.myClass('implied'), this.data.checked$, true).
            enableClass(this.myClass('checked'), this.data.checked$).
            add(this.slot(function(data$granted) {
              return data$granted ? '✓' : '';
            })).
            on('click', this.onClick);
        }
      ],
      listeners: [
        function onClick() {
          this.data.checked = ! this.data.checked;
        }
      ]
    }
  ]
});
