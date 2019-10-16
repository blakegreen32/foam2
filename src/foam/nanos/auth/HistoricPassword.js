/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.nanos.auth',
  name: 'HistoricPassword',

  documentation: 'Historic hashed password value for a user.',

  javaImports: [
    'java.util.Date'
  ],

  properties: [
    {
      class: 'DateTime',
      name: 'timeStamp',
      visibility: 'RO',
      documentation: 'Time at which password entry was created'
    },
    {
      class: 'String',
      name: 'password',
      documentation: 'Hashed password value.'
    },
  ]
 });