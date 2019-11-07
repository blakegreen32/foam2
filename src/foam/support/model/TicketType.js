foam.ENUM({
  package: 'foam.support.model',
  name: 'TicketType',

  documentation: 'Enum for selecting a ticket type when creating a support ticket.',

  values: [
    {
      name: 'GENERAL',
      label: 'General'
    },
    {
      name: 'ELEVATE_PERMISSION',
      label: 'Elevate Permission'
    }
  ]
});
