import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, Info } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: React.ReactNode;
  colorClass?: string;
  tooltip?: string; // Descripción de la métrica para usuarios
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subValue,
  trend,
  trendValue,
  icon,
  colorClass = "bg-blue-50 text-blue-600",
  tooltip
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col justify-between hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-gold-600 dark:text-gold-400">{title}</p>
            {tooltip && (
              <div className="relative inline-flex">
                <Info
                  className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 cursor-help hover:text-gold-500 dark:hover:text-gold-400 transition-colors"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                />
                {showTooltip && (
                  <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 px-3 py-2 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg animate-fade-in">
                    {tooltip}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                  </div>
                )}
              </div>
            )}
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</h3>
        </div>
        <div className={`p-3 rounded-lg ${colorClass}`}>
          {icon}
        </div>
      </div>

      {(subValue || trend) && (
        <div className="flex items-center text-sm">
          {trend === 'up' && <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />}
          {trend === 'down' && <ArrowDownRight className="w-4 h-4 text-red-500 mr-1" />}
          {trend === 'neutral' && <Minus className="w-4 h-4 text-gray-400 mr-1" />}

          <span className={`font-medium ${trend === 'up' ? 'text-green-600 dark:text-green-400' :
              trend === 'down' ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
            }`}>
            {trendValue}
          </span>
          {subValue && <span className="text-gray-400 dark:text-gray-500 ml-2">{subValue}</span>}
        </div>
      )}
    </div>
  );
};

export default KPICard;