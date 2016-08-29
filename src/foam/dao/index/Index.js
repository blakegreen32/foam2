/**
 * @license
 * Copyright 2012 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* Indexed Memory-based DAO. */

/*
 * TODO:
 *  update(oldValue, newValue)
 *  reuse plans
 *  add ability for indices to pre-populate data
 */


foam.CLASS({
  package: 'foam.dao.index',
  name: 'Plan',

  properties: [
    {
      name: 'cost',
      value: 0
    },
  ],

  methods: [
    function execute(/*promise, state, sink, skip, limit, order, predicate*/) {},
    function toString() { return this.cls_.name+"(cost="+this.cost+")"; }
  ]
});


/** Plan indicating that there are no matching records. **/
foam.CLASS({
  package: 'foam.dao.index',
  name: 'NotFoundPlan',
  extends: 'foam.dao.index.Plan',

  axioms: [ foam.pattern.Singleton.create() ],

  properties: [
    { name: 'cost', value: Number.MAX_VALUE }
  ],

  methods: [
    function toString() { return 'no-match(cost=0)'; }
  ]
});


/** Plan indicating that an index has no plan for executing a query. **/
foam.CLASS({
  package: 'foam.dao.index',
  name: 'NoPlan',
  extends: 'foam.dao.index.Plan',

  axioms: [ foam.pattern.Singleton.create() ],

  properties: [
    { name: 'cost', value: Number.MAX_VALUE }
  ],

  methods: [
    function toString() { return 'no-plan'; }
  ]
});


/** Convenience wrapper for indexes that want to create a closure'd function
    for each plan instance */
foam.CLASS({
  package: 'foam.dao.index',
  name: 'CustomPlan',
  extends: 'foam.dao.index.Plan',

  properties: [
    {
      class: 'Function',
      name: 'customExecute'
    },
    {
      class: 'Function',
      name: 'customToString'
    }
  ],

  methods: [
    function execute(promise, state, sink, skip, limit, order, predicate) {
      this.customExecute.call(
          this,
          promise,
          state,
          sink,
          skip,
          limit,
          order,
          predicate);
    },

    function toString() {
      return this.customToString.call(this);
    }
  ]
});


foam.CLASS({
  package: 'foam.dao.index',
  name: 'CountPlan',
  extends: 'foam.dao.index.Plan',

  properties: [
    {
      class: 'Int',
      name: 'count'
    }
  ],

  methods: [
    function execute(promise, sink /*, skip, limit, order, predicate*/) {
      sink.value += this.count;
    },

    function toString() {
      return 'short-circuit-count(' + this.count + ')';
    }
  ]
});


foam.CLASS({
  package: 'foam.dao.index',
  name: 'AltPlan',
  extends: 'foam.dao.index.Plan',

  properties: [
    {
      name: 'subPlans',
      postSet: function(o, nu) {
        this.cost = 1;
        for ( var i = 0; i < nu.length; ++i ) {
          this.cost += nu[i].cost;
        }
      }
    },
    'prop'
  ],

  methods: [
    function execute(promise, sink, skip, limit, order, predicate) {
      var sp = this.subPlans;
      for ( var i = 0 ; i < sp.length ; ++i) {
        sp[i].execute(promise, sink, skip, limit, order, predicate);
      }
    },

    function toString() {
      return ( this.subPlans.length <= 1 ) ?
        'IN(key=' + this.prop && this.prop.name + ', cost=' + this.cost + ", " +
          ', size=' + this.subPlans.length + ')' :
        'lookup(key=' + this.prop && this.prop.name + ', cost=' + this.cost + ", " +
          this.subPlans[0].toString();
    }
  ]
});


/** The Index interface for an ordering, fast lookup, single value,
  index multiplexer, or any other MDAO select() assistance class. */
foam.CLASS({
  package: 'foam.dao.index',
  name: 'Index',

  methods: [
    /** JS-prototype based 'Flyweight' constructor. Creates plain
      javascript objects that are __proto__'d to a modeled instance. */
    function create(args) {
      var c = Object.create(this);
      args && c.copyFrom(args);
      c.init && c.init();
      return c;
    },

    /** Adds or updates the given value in the index */
    function put() {},

    /** Removes the given value from the index */
    function remove() {},

    /** @return a Plan to execute a select with the given parameters */
    function plan(/*sink, skip, limit, order, predicate*/) {},

    /** @return the stored value for the given key. */
    function get() {},

    /** @return the integer size of this index. */
    function size() {},

    /** Selects matching items from the index and puts them into sink */
    function select(/*sink, skip, limit, order, predicate*/) { },

    /** Selects matching items in reverse order from the index and puts
      them into sink */
    function selectReverse(/*sink, skip, limit, order, predicate*/) { },
  ]
});


/** An Index which holds only a single value. **/
foam.CLASS({
  package: 'foam.dao.index',
  name: 'ValueIndex',
  extends: 'foam.dao.index.Index',
  implements: [ 'foam.dao.index.Plan' ],

  properties: [
    { class: 'Simple',  name: 'value' },
    { name: 'cost', value: 1 }
  ],

  methods: [
    // from plan
    function execute(promise, sink) {
      sink.put(this.value);
    },

    function toString() {
      return "ValueIndex_Plan(cost=1, value:" + this.value + ")";
    },

    // from Index
    function put(s) { this.value = s; },
    function remove() { this.value = undefined; },
    function get() { return this.value; },
    function size() { return typeof this.value === 'undefined' ? 0 : 1; },
    function plan() { return this; },

    function select(sink, skip, limit, order, predicate) {
      if ( predicate && ! predicate.f(this.value) ) return;
      if ( skip && skip[0]-- > 0 ) return;
      if ( limit && limit[0]-- <= 0 ) return;
      sink.put(this.value);
    },

    function selectReverse(sink, skip, limit, order, predicate) {
      this.select(sink, skip, limit, order, predicate);
    }
  ]
});



foam.CLASS({
  package: 'foam.dao.index',
  name: 'AltIndex',
  //extends: 'foam.dao.index.Index',

  requires: [
    'foam.dao.index.NoPlan',
  ],

  constants: {
    /** Maximum cost for a plan which is good enough to not bother looking at the rest. */
    GOOD_ENOUGH_PLAN: 10 // put to 10 or more when not testing
  },

  properties: [
    {
      name: 'delegates',
      factory: function() { return []; }
    }
  ],

  methods: [
    function addIndex(index) {
      // Populate the index
      var a = foam.dao.ArraySink.create();
      this.plan(a).execute([Promise.resolve()], a);

      index.bulkLoad(a);
      this.delegates.push(index);

      return this;
    },

    function bulkLoad(a) {
      for ( var i = 0 ; i < this.delegates.length ; i++ ) {
        this.delegates[i].bulkLoad(a);
      }
    },

    function get(key) {
      return this.delegates[0].get(key);
    },

    function put(newValue) {
      for ( var i = 0 ; i < this.delegates.length ; i++ ) {
        this.delegates[i].put(newValue);
      }
    },

    function remove(obj) {
      for ( var i = 0 ; i < this.delegates.length ; i++ ) {
        this.delegates[i].remove(obj);
      }
    },

    function plan(sink, skip, limit, order, predicate) {
      var bestPlan;
      //    console.log('Planning: ' + (predicate && predicate.toSQL && predicate.toSQL()));
      for ( var i = 0 ; i < this.delegates.length ; i++ ) {
        var plan = this.delegates[i].plan(sink, skip, limit, order, predicate);
        // console.log('  plan ' + i + ': ' + plan);
        if ( plan.cost <= this.GOOD_ENOUGH_PLAN ) {
          bestPlan = plan;
          break;
        }
        if ( ! bestPlan || plan.cost < bestPlan.cost ) {
          bestPlan = plan;
        }
      }
      //    console.log('Best Plan: ' + bestPlan);
      if ( ! bestPlan ) {
        return this.NoPlan.create();
      }
      return bestPlan;
    },

    function size() { return this.delegates[0].size(); },

    function toString() {
      return 'Alt(' + this.delegates.join(',') + ')';
    }
  ]
});


/** An Index which adds other indices as needed. **/
foam.CLASS({
  package: 'foam.dao.index',
  name: 'AutoIndex',
  extends: 'foam.dao.index.Index',

  requires: [
    'foam.core.Property',
    'foam.dao.index.NoPlan'
  ],

  properties: [
    {
      name: 'properties',
      factory: function() { return {}; }
    },
    {
      name: 'mdao'
    }
  ],

  methods: [
    function put() { },

    function remove() { },

    function bulkLoad() { return 'auto'; },

    function addIndex(prop) {
      if ( foam.mlang.order.Desc && foam.mlang.order.Desc.isInstance(prop) ) {
        prop = prop.arg1;
      }
      console.log('Adding AutoIndex : ', prop.id);
      this.properties[prop.name] = true;
      this.mdao.addIndex(prop);
    },

    function plan(sink, skip, limit, order, predicate) {
      if (
          order &&
          this.Property.isInstance(order) && ! this.properties[order.name]
      ) {
        this.addIndex(order);
      } else if ( predicate ) {
        // TODO: check for property in predicate
      }
      return this.NoPlan.create();
    },
    function toString() {
      return 'AutoIndex()';
    }
  ]
});


foam.CLASS({
  package: 'foam.dao.index',
  name: 'Journal',
  extends: 'foam.dao.index.Index',

  requires: [
    'foam.dao.index.NoPlan'
  ],

  properties: [
    {
      class: 'String',
      name: 'basename'
    },
    {
      class: 'Int',
      name: 'journalNo',
      value: 0
    },
    {
      class: 'Int',
      name: 'limit',
      value: 50000
    },
    {
      class: 'Int',
      name: 'recordCount',
      value: 0
    },
    {
      name: 'journal',
      factory: function() {
        return require('fs').createWriteStream(
          this.basename + this.journalNo + '.dat',
          { flags: 'a' });
      }
    }
  ],

  methods: [
    function put(obj) {
      this.journal.write('dao.put(foam.json.parse(');
      this.journal.write(foam.json.Storage.stringify(obj));
      this.journal.write('));\r\n');
      this.recordCount += 1;
      this.rollover();
    },

    function remove(obj) {
      this.journal.write('dao.remove(model.create(');
      this.journal.write(foam.json.Storage.stringify(obj));
      this.journal.write('));\r\n');
      this.recordCount += 1;
      this.rollover();
    },

    function plan() {
      return this.NoPlan.create();
    },

    function bulkLoad() {
    },

    function rollover() {
      if ( this.recordCount > this.limit ) {
        this.journal.end();
        this.recordCount = 0;
        this.journalNo += 1;
        this.journal = undefined;
      }
    },

    function compact() {
    }
  ]
});
