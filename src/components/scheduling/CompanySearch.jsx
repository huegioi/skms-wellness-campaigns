import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Calendar, Clock, MapPin, Users, Plus, Building2, X } from 'lucide-react';

export default function CompanySearch({ sheets, onAddToCalendar, addingToCalendar }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  const handleSearch = () => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    const results = [];
    sheets.forEach(sheet => {
      sheet.data.forEach(row => {
        const findVal = (row, ...keywords) => {
          for (const [key, value] of Object.entries(row)) {
            const keyLower = key.toLowerCase().trim();
            if (keywords.some(kw => keyLower === kw || keyLower.includes(kw)) && value && value.trim() !== '') {
              return value;
            }
          }
          return '';
        };

        const clientVal = findVal(row, 'client', 'payee', 'company').toLowerCase();

        if (!clientVal.includes(query)) return;

        // Find date
        let dateValue = null;
        for (const [key, value] of Object.entries(row)) {
          const keyLower = key.toLowerCase();
          if ((keyLower.includes('date') || keyLower.includes('day') || keyLower === 'when') && value && value.trim() !== '') {
            dateValue = value;
            break;
          }
        }

        let eventDate = null;
        if (dateValue) {
          eventDate = new Date(dateValue);
          if (isNaN(eventDate.getTime())) {
            const parts = dateValue.split('/');
            if (parts.length === 3) {
              eventDate = new Date(parts[2], parts[0] - 1, parts[1]);
            }
          }
          if (isNaN(eventDate?.getTime())) eventDate = null;
        }

        // Find title
        let title = 'Untitled Event';
        for (const [key, value] of Object.entries(row)) {
          if ((key.toLowerCase().includes('event') ||
               key.toLowerCase().includes('service') ||
               key.toLowerCase().includes('title') ||
               key.toLowerCase().includes('name')) && value) {
            title = value;
            break;
          }
        }

        results.push({
          date: eventDate,
          title,
          client: row['Client'] || row['Payee'] || row['Company'] || row['CLIENT'] || row['client'] || row['PAYEE'] || '',
          location: row['Location'] || row['LOCATION'] || row['location'] || row['Venue'] || '',
          time: row['Time'] || row['TIME'] || row['time'] || '',
          presenter: row['Presenter'] || row['PRESENTER'] || row['presenter'] || '',
          linkToHost: row['Link to Host Video'] || row['Link To Host Video'] || '',
          recording: row['Recording'] || row['RECORDING'] || '',
          translation: row['Translation'] || row['TRANSLATION'] || '',
          sheet: sheet.name,
          rawRow: row,
          source: 'sheet'
        });
      });
    });

    results.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date - b.date;
    });

    setSearchResults(results);
  };

  const handleClear = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  const now = new Date();

  return (
    <div className="mt-8">
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-1 flex items-center gap-2" style={{ color: '#013f7c' }}>
            <Building2 className="w-5 h-5" />
            Search Events by Company
          </h2>
          <p className="text-sm text-gray-500 mb-4">Search the Google Sheet for all events associated with a company</p>

          <div className="flex gap-2">
            <Input
              placeholder="Enter company name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="bg-white border-blue-200 focus:border-blue-400"
            />
            <Button onClick={handleSearch} className="bg-[#013f7c] hover:bg-[#012d5a] shrink-0">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
            {searchResults !== null && (
              <Button variant="outline" onClick={handleClear} className="shrink-0">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {searchResults !== null && (
            <div className="mt-5">
              {searchResults.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p>No events found for "<span className="font-medium">{searchQuery}</span>"</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-3 font-medium">
                    Found <span className="text-[#013f7c] font-bold">{searchResults.length}</span> event{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
                  </p>
                  <div className="space-y-3">
                    {searchResults.map((event, idx) => {
                      const isPast = event.date ? event.date < now : false;
                      return (
                        <div
                          key={idx}
                          className={`rounded-lg p-4 border transition-shadow hover:shadow-md ${
                            isPast ? 'bg-gray-50 border-gray-200 opacity-70' : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                            <div className="flex items-center gap-3 min-w-[140px]">
                              <Calendar className={`w-5 h-5 ${isPast ? 'text-gray-400' : 'text-blue-600'}`} />
                              <div>
                                <div className={`font-semibold text-sm ${isPast ? 'text-gray-400' : ''}`} style={isPast ? {} : { color: '#013f7c' }}>
                                  {event.date
                                    ? event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                    : 'No date'}
                                </div>
                                {event.time && (
                                  <div className="text-xs text-gray-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {event.time}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <div className={`font-semibold ${isPast ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                  {event.title}
                                </div>
                                {isPast && <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-500">Past</span>}
                                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">{event.sheet}</span>
                              </div>
                              {event.client && (
                                <div className={`text-sm flex items-center gap-1 mb-1 ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>
                                  <Users className="w-3 h-3" />
                                  {event.client}
                                </div>
                              )}
                              {event.presenter && (
                                <div className={`text-sm mb-1 ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>
                                  <span className="font-medium">Presenter:</span> {event.presenter}
                                </div>
                              )}
                              {event.location && (
                                <div className={`text-sm flex items-center gap-1 ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>
                                  <MapPin className="w-3 h-3" />
                                  {event.location}
                                </div>
                              )}
                            </div>
                            {!isPast && (
                              <Button
                                size="sm"
                                onClick={() => onAddToCalendar(event)}
                                disabled={addingToCalendar === event.title}
                                className="bg-[#264d44] hover:bg-[#1a3830] whitespace-nowrap self-start"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                {addingToCalendar === event.title ? 'Adding...' : 'Add to Calendar'}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}